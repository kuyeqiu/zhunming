# Agent Note: UI 改完没上线——dev 与线上 dist 的脱节

Status: implemented

## Problem

连续几轮把首页、账户页、外壳、主题都改了，也在本地 `localhost:5173` 截图验证过，但**线上 `https://m.receler.tech` 一点没变**。用户打开看到的是切换那天部署的旧 `dist/`：左侧还是 248px 侧栏、主视觉还是水墨眼、深色系统下依旧"黑侧栏 + 白纸块"。

根因不是构建失败，而是流程缺口：**我一直在 dev server 上验收，从未把改动重新构建并部署**。`pnpm dev` 走 Vite 内存编译，改一次刷一次，看起来一切正常；线上跑的是 `dist/` 静态产物，两者之间没有任何同步机制。

危险点在于：这个缺口不会报错。dev 全绿、`tsc` 全绿、`pnpm build` 也全绿，唯独线上是旧的。

## Decision

把"上线"补成显式步骤，并给 UI-only 改动一条更短的通道。

**增量发布（只改了前端）**

```powershell
cd E:\Daima\mingyu\app
corepack pnpm run build
tar -czf ..\mingyu-dist.tar.gz -C dist .
# 上传后在服务器：
cd /zhunming-next && mv dist dist.old-$(date +%H%M%S) && mkdir dist && tar -xzf /root/mingyu-dist.tar.gz -C dist
```

服务端不需要重启：`docker-server.ts` 每次请求从磁盘读 `dist/`，静态资源直接生效。

**验收以线上为准，不以 dev 为准**

每次发布后必须验两样，缺一不算完成：

1. 线上 CSS 里存在本次改动的标记（本轮是 `ink-topbar`、`data-ink-mode`）；
2. 线上 JS 里存在本次新增的文案（本轮是 `水墨罗盘`）。

```bash
curl -s https://m.receler.tech/ | grep -o 'assets/index-[A-Za-z0-9._-]*\.css'
curl -s https://m.receler.tech/assets/index-XXXX.css | grep -c ink-topbar
```

## Alternatives considered

1. **在服务器上 `pnpm build`**：省掉上传，但 1.8G 内存跑 vite 有 OOM 风险，且每次多 3–5 分钟；增量发布只需传 12MB 静态产物。
2. **每次全量走 `deploy-next.sh`**：最"正规"，但会重装依赖、重跑 seed（每次多生成 5 个兑换码），对纯 UI 改动过重。
3. **用 rsync 增量同步 dist**：更快，但服务器上 `dist.old-*` 的保留策略会变复杂；tar 全量替换更可预测。
4. **靠 CI 自动部署**：最终形态，但当前是手工运维的宝塔机器，先把手动步骤固化。

## Consequences

- 收益：确立了"dev 验收 ≠ 上线"这条纪律，并写下了可机械执行的线上标记检查。
- 代价：`dist.old-*` 会随每次发布累积（每个约 12–30MB），需要定期清理；本轮已存在一个。
- 代价：标记检查依赖我一并想好"本次改动的唯一字符串"，忘了埋标记就退化成"看起来发了"。
- 未验证：`dist.old-*` 回滚没有实际演练过（只是留着目录）。
- 验证：本轮重建后线上 `assets/index-knIEKw-Y.css` 含 `ink-topbar`、`data-ink-mode`，`assets/index-wrlc9e45.js` 含 `水墨罗盘`；`https://m.receler.tech/` 截图确认顶栏 + 罗盘已生效。
