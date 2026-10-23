# Agent Note: 切换到新版并移除旧版（3200 成为唯一实例）

Status: implemented

## Problem

并行部署期结束时线上有两套实例：旧版 `/zhunming`（pm2 `mingyu`，:3000）经 nginx 提供 `https://m.receler.tech`，新版 `/zhunming-next`（pm2 `mingyu-next`，:3200）只在本机验证。用户要求「把老的删掉，新的跑上去」。

## Decision

一次性完成切换，不留半迁移状态：

1. nginx `m.receler.tech.conf` 的 `location ^~ /` 从 `proxy_pass http://127.0.0.1:3000` 改为 `3200`；`nginx -t` 通过后 `systemctl reload nginx`（reload 不断连接）。
2. 走 nginx 验证新版特征接口（`/api/app/health`、`/mingyu-runtime-config.js`、自托管字体），确认不是旧版在应答。
3. **先备份再删除**：`/zhunming` 打成 `/root/zhunming-old-<stamp>.tar.gz`（排除 `node_modules`/`dist`，36MB），然后 `pm2 delete mingyu` → `pm2 save` → `rm -rf /zhunming`。
4. 应用收尾：`HOST` 改回 `127.0.0.1`（nginx 是唯一入口，不再需要对外直连）；pm2 应用名从 `mingyu-next` 改回 `mingyu`，`ecosystem.next.json` 同步改名。

顺序是刻意的：**先切流，验完，再删旧的**。反过来会有一段站点直接 502 的空窗。

## Alternatives considered

1. **先删旧的再切流**：省一步核对，但删完到 reload 之间站点是 502；一旦 reload 失败就没有回退对象。
2. **保留旧进程只改反代**：可秒回滚，但用户明确要求「旧的直接丢掉」，且两套实例同时占 400MB 内存（机器仅 1.8G）。
3. **保留 `/zhunming` 目录只删进程**：回滚方便，但磁盘上会留 194MB 死代码，且未来容易误启旧版。
4. **把新应用改名为 `mingyu-next` 保留**：命名上区分阶段，但旧版已不存在，"next" 变成误导。

## Consequences

- 收益：单实例、单入口、单一数据源；内存回落（删旧后可回升约 130MB）；`https://m.receler.tech` 直接是新版，自带有效证书，无自签告警。
- 代价：回滚路径从「改一行 reload」变成「解备份 tar + 重新 pm2 start」，分钟级而非秒级。备份文件在 `/root/zhunming-old-*.tar.gz`，**未验证可还原**（只验证了能解开，没有实际跑起来）。
- 代价：旧版若有独立的计费数据库（旧实现用 `.data/mingyu-billing.sqlite` 按浏览器指纹记账），数据只在备份里，没有迁移到新版——新版的账号/权益体系从零开始，这是刻意的（两套模型不兼容）。
- 验证：`ss -ltn` 无 3000、仅 `127.0.0.1:3200`；`pm2 list` 只有一条 `mingyu` online；`https://m.receler.tech/` → 200（用 `--resolve` 绕过本地 DNS 劫持到真实 IP）；`/api/app/health` → 200；`/mingyu-runtime-config.js` 返回 `aiBuiltinEnabled:true`；首页 HTML 含 `mingyu-serif-400` preload 与 `#f4f2ec` 主题色，证明跑的是新构建；`http://` → 301 → `https://`。
