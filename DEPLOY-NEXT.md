# 新版准命 · 部署（已完成切换）

> **当前线上状态（2026-10-21 切换完成）**
> - 入口：`https://m.receler.tech`（80 → 443 跳转，证书到 2027-01-17）
> - nginx：`/www/server/panel/vhost/nginx/m.receler.tech.conf`，`location ^~ /` → `127.0.0.1:3200`
> - 应用：`/zhunming-next`，pm2 `mingyu`（名字已从 `mingyu-next` 改回 `mingyu`），只监听 `127.0.0.1:3200`
> - 旧版：**已删除**（`/zhunming` 移除，pm2 `mingyu` 旧进程删除，3000 端口关闭）
> - 旧版精简备份：`/root/zhunming-old-<stamp>.tar.gz`（约 36MB，排除 node_modules/dist）
>
> 下文保留并行部署时期的流程，用于**再次部署/加机器**时参考。
## 复现流程（打包 → 上传 → 部署）

> 现网 `/zhunming`（旧版，pm2 `mingyu`，:3000）不动；新版装到 `/zhunming-next`（pm2 `mingyu-next`，:3200）。
> 验证满意后再把 80 反代从 3000 切到 3200，随时可切回。

## 一、打包装箱（本地）

```powershell
pwsh -NoProfile -File E:\Daima\mingyu\app\scripts\make-next-package.ps1
# -> E:\Daima\mingyu\mingyu-next.tar.gz（约 18.6 MB）
```

包里是**构建产物 + 源码 + 语料**，不含 `node_modules`：

```
dist/                 已构建前端（含 /fonts 自托管宋体子集）
packages/core/dist/   核心包 ESM 产物
server/               业务后端（auth / billing / admin / gate）
src/                  docker-server 运行期引用（public-api、ai、mcp handler）
functions/ mcp/       /sse 与 MCP 入口
public/ rag/ patches/ 静态资源、RAG 语料、pnpm 补丁
```

**不要漏 `mcp/` 与 `patches/`**：前者被 `src/lib/mcp/handler.ts` 引用（缺了进程起不来），
后者是 `iztro` 的 pnpm patch（缺了 `pnpm install` 直接 ENOENT）。这两处都踩过。

## 二、上传并部署（服务器）

```bash
scp mingyu-next.tar.gz root@<IP>:/root/
bash deploy-next.sh /root/mingyu-next.tar.gz
```

`deploy-next.sh` 九步：前置检查（Node≥22 / corepack / 磁盘 3GB）→ 备份 → 解包（保留 `.data` 与 `.env.local`）
→ 环境变量（并自动从 `/zhunming/.env.local` 迁 `AI_*`）→ `pnpm install --frozen-lockfile` → 校验产物
→ `seed` 初始化商品与兑换码 → pm2（JSON 配置，不用 `.cjs`）→ 健康检查。

幂等：可重复执行，只在首次生成 `.env.local`。

### 两个必须知道的坑

1. **pm2 不认 `.cjs` 配置**：`pm2 start ecosystem.next.cjs` 会把它当脚本跑，进程名变成 `ecosystem.next` 且不起服务。用 `.json`。
2. **安装包必须带 `mcp/`**：服务端顶层会 import `src/lib/mcp/handler.ts`，它再 import `mcp/src/create-server.js`；缺目录直接 `ERR_MODULE_NOT_FOUND`，健康检查 000。

## 三、环境变量

```ini
HOST=0.0.0.0            # 并行自检期直连用；切到 nginx 反代后建议 127.0.0.1
PORT=3200
MINGYU_DATA_DIR=/zhunming-next/.data
MINGYU_BOOTSTRAP_ADMIN_EMAIL=   # 填你的邮箱；用该邮箱注册的第一个账号成为管理员
MINGYU_PAYWALL_ENABLED=true
MINGYU_FREE_AI_DAILY=3
AI_BASE_URL= AI_MODEL= AI_API_KEY=
AI_BUILTIN_ENABLED=true AI_DEFAULT_ENABLED=true AI_PROVIDER_NAME=准命 AI
```

`AI_BUILTIN_ENABLED` 缺了会让前端读到 `aiBuiltinEnabled:false`，页面就不走服务端 AI 了——部署后可用
`curl http://127.0.0.1:3200/mingyu-runtime-config.js` 自查。

## 四、对外开放（二选一）

**A. 安全组放行 3200**（并行自检，推荐先做这个）
华为云控制台 → 安全组 → 入方向加 `TCP:3200, 0.0.0.0/0`，然后访问 `http://<IP>:3200/`。
> 注意：仅 ufw 放行不够。实测服务器自己访问自己的公网 IP:3200 都不通，说明是安全组在拦。

**B. 切到 80（正式上线）**
把宝塔站点 vhost 的 `proxy_pass http://127.0.0.1:3000` 改成 `3200`，`systemctl reload nginx`。
回滚：改回 3000 再 reload，旧进程一直在跑，秒回。

## 五、验收命令

```bash
pm2 list                                      # mingyu-next online
curl -s http://127.0.0.1:3200/api/app/health  # {"ok":true,...}
curl -s http://127.0.0.1:3200/api/app/products | head -c 120
curl -s http://127.0.0.1:3200/mingyu-runtime-config.js
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3200/fonts/mingyu-serif-400.woff2
```

## 六、首次部署后要做的

1. 填 `MINGYU_BOOTSTRAP_ADMIN_EMAIL` → `pm2 restart mingyu-next --update-env`
2. 打开 `/account` 用该邮箱注册 → 自动成为管理员
3. 进 `/admin`：确认商品三条、兑换码批次
4. 生成一批兑换码给运营；`/account` 兑换后权益即到账

## 只改前端时的增量发布（12MB，不重启）

```powershell
cd E:\Daima\mingyu\app
corepack pnpm run build
tar -czf ..\mingyu-dist.tar.gz -C dist .
```

上传 `mingyu-dist.tar.gz` 到 `/root/`，然后：

```bash
cd /zhunming-next
mv dist dist.old-$(date +%H%M%S)
mkdir -p dist && tar -xzf /root/mingyu-dist.tar.gz -C dist
```

不用 `pm2 restart`：服务端每次请求从磁盘读 `dist/`。

### 发布后必验（不接受只验 dev）

```bash
CSS=$(curl -s https://m.receler.tech/ | grep -o 'assets/index-[A-Za-z0-9._-]*\.css' | head -1)
curl -s "https://m.receler.tech/$CSS" | grep -c ink-topbar   # 本次改动的唯一标记
```

看 CSS/JS 里能不能搜到本次改动的标记字符串；搜不到就是没上线。

> 教训：只在 `localhost:5173` 截图验收过一次，结果线上停在旧包好几轮（见
> `.agents/notes/implemented/process/2026-10-21-ui-changes-not-deployed.md`）。