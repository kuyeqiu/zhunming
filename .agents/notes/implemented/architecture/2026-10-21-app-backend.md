# Agent Note: 业务后端（账号/收费）落地在 server/app

Status: implemented

## Problem

新版上游只有 `server/docker-server.ts`：静态分发、`/mingyu-runtime-config.js` 注入、AI 代理，没有任何用户体系。产品需要注册登录、管理后台与收费，而 `packages/core` 里是 32 个术数系统的确定性计算——任何账号与计费代码进入核心包，都会让上游同步（605 个提交的差距）变成灾难。

## Decision

新增 `server/app/` 作为业务后端，单进程 Node 24，零新增依赖，对核心包零侵入。

**分层**

```
server/app/
  db.ts        node:sqlite(DatabaseSync) + WAL + 幂等迁移 + 事务包装
  security.ts  scrypt 口令哈希、会话令牌、ID、邮箱规范化
  session.ts   会话签发/解析/吊销
  http.ts      JSON 收发、Cookie、客户端 IP、限流桶
  auth.ts      /api/app/auth/* 路由
  billing.ts   商品/权益/余额/兑换码/订单
  index.ts     /api/app/* 分发入口
  seed.ts      初始化商品与兑换码（幂等）
```

`docker-server.ts` 只在 `/api/app/*` 前缀上插入一次分发，未命中返回 `false` 继续走静态；`/api/v1/*` 的公共排盘 API 完全不动。

**关键不变量**

- 口令：`scrypt`（N=16384, r=8, p=1），参数写进哈希串 `scrypt$N$r$p$salt$hash`，将来调参不需要迁移数据；校验用 `timingSafeEqual`。
- 会话：32 字节随机令牌，**只把 SHA-256 摘要入库**，库被读走也无法冒用；Cookie `my_sess` 为 `HttpOnly + SameSite=Lax + Path=/`，`Secure` 由 `X-Forwarded-Proto` 决定。不用 JWT——封禁与改密需要服务端可撤销。
- 改密会吊销该用户全部会话（含当前会话），前端必须重新登录。
- 客户端 IP 只有**直连方是本机**（反向代理）时才相信 `X-Real-IP`，否则任何人都能伪造头部绕过登录限流与审计。
- 余额（`balances.credits`）是唯一扣费入口；兑换码与未来的在线支付都先入账到余额，避免多套账。
- 兑换码核销整段包在 `BEGIN IMMEDIATE` 事务里：`used_count` 自增、`cdk_redemptions` 记录、权益与订单写入要么全成要么全败；同一用户对同一码只能兑一次。
- 首个管理员由 `MINGYU_BOOTSTRAP_ADMIN_EMAIL` 决定，不靠"第一个注册的人"这种隐式规则。

**数据位置**

`MINGYU_DATA_DIR`（默认 `<cwd>/.data`）下的 `mingyu-app.sqlite`，WAL 模式，`busy_timeout=5000`。

### 管理后台 API

`server/app/admin.ts`，前缀 `/api/app/admin/*`，两条硬规则：

1. **非 admin 返回 404 而不是 403**——与"接口不存在"同形，不暴露后台存在性；
2. **所有写操作进 `audit_log`**（`server/app/audit.ts`），记录 actor / action / target / payload，审计写入失败只打日志不阻断主流程。

接口：`overview`（用户数、有效用户、已付订单、营收、活跃权益、兑换码使用率）、`users`（含余额/权益数/累计消费，支持 `q` 搜索）、`users/:id`（改角色/停用，停用即吊销全部会话；禁止取消自己的管理员）、`orders`（跨用户）、`products`（含下架项，POST 为 upsert）、`cdk/batches`（GET 批次统计，POST 生成，整段事务内查重）、`audit`。

## Alternatives considered

1. **Supabase / 自建 Postgres + JWT**：省鉴权代码，但要额外服务与内存（部署机 1.8G），JWT 又无法即时封禁。
2. **移植旧版 `server/billing/`（1439 行）**：旧实现按浏览器指纹给免费次数，没有用户实体与订单/权益概念，与旧 server 结构深度绑定，移植成本高于按新模型重写。
3. **引 Express/Fastify**：路由写起来快，但现有 server 已是原生 http，为一个前缀引入框架会让依赖面变大，收益不抵。
4. **口令用 bcrypt/argon2**：需要原生编译（Windows 与 Debian 都要预编译产物），scrypt 是 Node 内置，部署零摩擦。
5. **把服务端代码并入 `src/`**：会被 App 的 tsconfig 收录，前端类型检查里混入 Node 代码；单独 `tsconfig.server.json` 更清晰。

## Consequences

- 收益：账号、兑换码、权益、订单已是可跑通的闭环，前端只需接 `/api/app/*`；核心包保持干净，仍可 `git merge` 上游。
- 代价：`typecheck` 主链没有覆盖后端（`tsconfig.node.json` 只含 `vite.config.ts`），所以新增了 `typecheck:server`；目前没接进 `pnpm typecheck`，部署前需要单独跑，属于已知的纪律缺口。
- 代价：限流是单进程内存桶，多实例部署会失效；当前单机部署可接受。
- 未做：管理后台 API、前端登录界面、付费墙判定、AI 用量记账、RAG 检索。
- 验证：`tsc --project tsconfig.server.json --noEmit` 通过；实测 `register → me → logout → login → products → redeem → redeem(重复) → summary` 全链路，重复核销返回「兑换码已被使用」，`summary` 返回带 `expiresAt` 的权益与 `channel=cdk` 的订单。
