# Agent Note: 新版并行部署（/zhunming-next :3200）

Status: implemented

> 后续：并行部署已在同一天结束，线上只保留新版，见 [切换到新版并移除旧版](2026-10-21-cutover-to-next.md)。本文档保留并行期的取舍与两个 pm2/打包坑。

## Problem

现网 `/zhunming` 是旧版，pm2 `mingyu` 跑在 :3000，宝塔 nginx 的 80 vhost 反代到它。新版多了账号、订单、权益、SQLite 数据目录与一批 `MINGYU_*` 环境变量，直接覆盖部署会把现网连数据一起换掉，出问题只能靠备份回滚。

## Decision

**并行部署**，两套进程同时在线，切换只改一行反代：

| | 旧版 | 新版 |
| --- | --- | --- |
| 目录 | `/zhunming` | `/zhunming-next` |
| pm2 | `mingyu` | `mingyu-next` |
| 端口 | 3000 | 3200 |
| 入口 | nginx 80 vhost | 暂为直连，验证后切反代 |

`deploy-next.sh` 九步幂等：前置检查（Node≥22 / corepack / 磁盘）→ 备份 → 解包（保留 `.data` 与 `.env.local`）
→ 环境变量（自动从旧版迁 `AI_*`）→ `pnpm install --frozen-lockfile` → 校验产物 → `seed` → pm2 → 健康检查。

**不在服务器上构建**：本地已产出 `dist/` 与 `packages/core/dist`，服务器只装依赖。1.8G 内存上跑 vite 是赌博。

**切换与回滚**：把 vhost 的 `proxy_pass` 从 3000 改成 3200 即上线；改回即回滚，旧进程一直在跑。

## Alternatives considered

1. **就地覆盖 `/zhunming`**：省一个目录，但新旧共用路径会让「回滚」变成「从备份恢复」，而备份是 tar，恢复期间站点不可用。
2. **Docker**：隔离更彻底，但现网是宝塔 + pm2 体系，引 Docker 要额外维护镜像构建与数据卷，收益不抵成本。
3. **在服务器上 `pnpm build`**：省得本地打包，但 1.8G 内存上 vite 构建有 OOM 风险，且每次部署多 3–5 分钟。
4. **用 nginx 路径前缀挂新版（/next）**：SPA 用绝对资源路径（`/assets/...`），前缀会让所有静态资源 404，除非改 `base`，不值得。
5. **让 3200 直接对外**：需要安全组放行；实测被拦（见下），所以对外仍走 80 反代。

## Consequences

- 收益：现网零风险；切换/回滚都是一行；新版数据独立（`/zhunming-next/.data/mingyu-app.sqlite`，WAL 已生效）。
- 代价：两套进程同时占内存（133MB + 167MB，机器 1.8G，可用仍 955MB）；切换前必须记得停旧版或至少确认不再需要。
- 代价：`deploy-next.sh` 里包含从 `/zhunming/.env.local` 读 `AI_*` 的迁移逻辑——这是对旧目录的隐式依赖，旧版被删后该逻辑要改成纯手工填。
- **踩过的两个坑已固化进脚本**：
  1. pm2 不把 `.cjs` 当配置：`pm2 start ecosystem.next.cjs` 会当脚本跑，进程名变 `ecosystem.next` 且不起服务 → 改用 `.json`；
  2. 安装包漏 `mcp/` 与 `patches/`：前者导致 `ERR_MODULE_NOT_FOUND`（`src/lib/mcp/handler.ts` → `mcp/src/create-server.js`），后者导致 `pnpm install` ENOENT（`iztro@2.5.8.patch`）。
- **环境事实**：安全组只放行了 22 / 80 / 443 / 12781，3200 未放行。仅 ufw 放行不够——实测**服务器自己 curl 自己的公网 IP:3200 都不通**，说明拦截在安全组层。
- 验证：`pm2 list` 两条 online；`:3000` 与 `:80` 仍 200（旧版未受影响）；`:3200` 环回 200；`mingyu-runtime-config.js` 返回 `aiBuiltinEnabled:true`；`.data` 生成 140KB sqlite + WAL。
