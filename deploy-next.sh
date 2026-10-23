#!/usr/bin/env bash
# =============================================================================
# 新版准命 · 服务器侧一键部署（并行部署，不动现网 /zhunming）
#
#   用法： bash deploy-next.sh /root/mingyu-next.tar.gz
#
# 设计原则：
#   - 与旧版 `/zhunming`(3000) 并存：新版装到 `/zhunming-next`，监听 3200；
#   - 幂等：可重复执行，只在首次创建 .env.local 与 .data；
#   - 不跑构建：本地已产出 dist/，服务器只装依赖，避免 1.8G 内存上跑 vite；
#   - 失败即停（set -euo pipefail），每步都有可读输出。
# =============================================================================
set -euo pipefail

APP_DIR=/zhunming-next
APP_NAME=mingyu-next
APP_PORT=3200
TARBALL="${1:-}"
STAMP="$(date +%Y%m%d-%H%M%S)"

log() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { printf '\n!! %s\n' "$*" >&2; exit 1; }

[ -n "$TARBALL" ] || die "用法：bash deploy-next.sh /path/to/mingyu-next.tar.gz"
[ -f "$TARBALL" ] || die "找不到安装包：$TARBALL"

# ---------- 0. 前置检查 ----------
log "0/9 前置检查"
command -v node >/dev/null || die "缺少 node"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 22 ] || die "需要 Node >= 22（node:sqlite），当前 $(node -v)"
command -v corepack >/dev/null || die "缺少 corepack"
PNPM_VER="$(corepack pnpm -v 2>/dev/null || echo '')"
[ -n "$PNPM_VER" ] || die "corepack pnpm 不可用"
log "   node $(node -v) / pnpm $PNPM_VER"
df -Pk / | awk 'NR==2 { if ($4+0 < 3145728) { print "!! 根分区可用空间不足 3GB"; exit 1 } }'

# ---------- 1. 备份 ----------
if [ -d "$APP_DIR" ]; then
  log "1/9 备份现有目录"
  tar -czf "/root/zhunming-next-$STAMP.tar.gz" -C / "$(basename "$APP_DIR")" 2>/dev/null || true
  log "   已备份到 /root/zhunming-next-$STAMP.tar.gz"
else
  log "1/9 首次部署，无需备份"
fi

# ---------- 2. 解包 ----------
log "2/9 解包到 $APP_DIR（保留 .data 与 .env.local）"
mkdir -p "$APP_DIR"
PRESERVED="$(mktemp -d)"
[ -f "$APP_DIR/.env.local" ] && cp "$APP_DIR/.env.local" "$PRESERVED/.env.local"
[ -d "$APP_DIR/.data" ] && cp -a "$APP_DIR/.data" "$PRESERVED/.data"
find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name '.data' ! -name '.env.local' -exec rm -rf {} +
tar -xzf "$TARBALL" -C "$APP_DIR" --strip-components=0
[ -f "$PRESERVED/.env.local" ] && cp "$PRESERVED/.env.local" "$APP_DIR/.env.local"
[ -d "$PRESERVED/.data" ] && cp -a "$PRESERVED/.data" "$APP_DIR/.data"
rm -rf "$PRESERVED"
cd "$APP_DIR"

# ---------- 3. 环境变量 ----------
log "3/9 环境变量"
if [ ! -f .env.local ]; then
  cp .env.next.example .env.local
  sed -i "s/^PORT=.*/PORT=$APP_PORT/" .env.local
  sed -i "s#^MINGYU_DATA_DIR=.*#MINGYU_DATA_DIR=$APP_DIR/.data#" .env.local
  log "   已生成 .env.local —— 需要手工填 AI_API_KEY 与 MINGYU_BOOTSTRAP_ADMIN_EMAIL"
else
  log "   沿用已有 .env.local"
fi
chmod 600 .env.local
mkdir -p "$APP_DIR/.data"

# 从旧版（/zhunming）复制 AI 凭据与开关：只碰 AI_* 与 BILLING 无关项，避免手抄出错
if [ -f /zhunming/.env.local ]; then
  for k in AI_BASE_URL AI_MODEL AI_API_KEY; do
    v="$(grep -E "^$k=" /zhunming/.env.local 2>/dev/null | head -1 || true)"
    [ -n "$v" ] && sed -i "s|^$k=.*|$v|" .env.local
  done
fi
for kv in AI_BUILTIN_ENABLED=true AI_DEFAULT_ENABLED=true "AI_PROVIDER_NAME=准命 AI"; do
  k="${kv%%=*}"
  grep -q "^$k=" .env.local || echo "$kv" >> .env.local
done
if [ -n "${OVERWRITE_HOST:-}" ]; then sed -i "s/^HOST=.*/HOST=$OVERWRITE_HOST/" .env.local; fi
log "   AI 内置开关：$(grep '^AI_BUILTIN_ENABLED=' .env.local || echo 未配置)"

# ---------- 4. 依赖 ----------
log "4/9 安装依赖（沿用 lockfile）"
corepack pnpm install --frozen-lockfile --prefer-offline

# ---------- 5. 校验产物 ----------
log "5/9 校验构建产物"
[ -f dist/index.html ] || die "缺少 dist/index.html（安装包里必须带构建产物）"
[ -d packages/core/dist ] || die "缺少 packages/core/dist（运行时按 ESM 引用）"
[ -f public/fonts/mingyu-serif-400.woff2 ] || log "   提示：未包含自托管字体子集，标题会回退系统宋体"

# ---------- 6. 初始化数据 ----------
log "6/9 初始化商品与兑换码"
node --env-file=.env.local --import=tsx server/app/seed.ts 5 | sed 's/^/   /'

# ---------- 7. 启动进程 ----------
log "7/9 启动 pm2 进程 $APP_NAME"
# 用 JSON 配置：pm2 对 .cjs 后缀不会当作配置文件解析（会当成脚本跑，名字也取错）
cat > ecosystem.next.json <<EOF
{
  "apps": [
    {
      "name": "$APP_NAME",
      "cwd": "$APP_DIR",
      "script": "node",
      "args": "--env-file=.env.local --import=tsx server/docker-server.ts",
      "max_memory_restart": "700M",
      "env": { "NODE_ENV": "production" },
      "out_file": "/root/.pm2/logs/$APP_NAME-out.log",
      "error_file": "/root/.pm2/logs/$APP_NAME-error.log"
    }
  ]
}
EOF
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
pm2 delete ecosystem.next >/dev/null 2>&1 || true
pm2 start ecosystem.next.json
pm2 save >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

# ---------- 8. 健康检查 ----------
log "8/9 健康检查"
for i in $(seq 1 20); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$APP_PORT/api/app/health" || true)"
  [ "$CODE" = "200" ] && break
  sleep 1
done
[ "$CODE" = "200" ] || die "健康检查失败（last=$CODE），看 /root/.pm2/logs/$APP_NAME-error.log"

log "   后端 /api/app/health  -> 200"
curl -s -o /dev/null -w '   首页 /            -> %{http_code}\n' "http://127.0.0.1:$APP_PORT/"
curl -s "http://127.0.0.1:$APP_PORT/api/app/products" | head -c 160; echo
curl -s -o /dev/null -w '   字体子集          -> %{http_code}\n' "http://127.0.0.1:$APP_PORT/fonts/mingyu-serif-400.woff2"

# ---------- 9. 收尾提示 ----------
log "9/9 完成"
cat <<EOF

新版已启动： http://127.0.0.1:$APP_PORT
  pm2 名称   : $APP_NAME
  目录       : $APP_DIR
  日志       : /root/.pm2/logs/$APP_NAME-{out,error}.log
  数据库     : $APP_DIR/.data/mingyu-app.sqlite

还要做的两件事：
  1) 编辑 $APP_DIR/.env.local，填 AI_API_KEY 与 MINGYU_BOOTSTRAP_ADMIN_EMAIL，
     然后 pm2 restart $APP_NAME --update-env
  2) 对外访问二选一：
     a. 安全组放行 $APP_PORT，直接 http://<IP>:$APP_PORT/
     b. 切到 nginx：把 80 的 vhost 反代目标从 3000 改成 $APP_PORT
        （/www/server/panel/vhost/nginx/<站点>.conf 里 proxy_pass）
EOF
