#!/usr/bin/env bash
# =============================================================================
# 增量同步前端产物到线上服务器（纯 UI / 前端改动通道）
#
#   bash scripts/sync-dist.sh                  # 快速构建（node scripts/run-vite-build.mjs）
#   bash scripts/sync-dist.sh --full           # 完整构建（pnpm run build，含 core 与 pages discovery）
#   bash scripts/sync-dist.sh --no-build       # 跳过构建，直接上传现有 dist/
#
# 环境变量：
#   MINGYU_SERVER    ssh 别名或 user@host，默认 mingyu-server（见 ~/.ssh/config）
#   MINGYU_MARKER    本次改动的唯一标记字符串，用于线上验收（强烈建议传）
#   MINGYU_APP_DIR   服务器上的应用目录，默认 /zhunming-next
#   MINGYU_APP_PORT  服务器上的监听端口，默认 3200
#
# 服务端 docker-server 每次请求从磁盘读 dist/，替换目录后不需要重启 pm2。
# =============================================================================
set -euo pipefail

MODE="${1:-}"
HOST="${MINGYU_SERVER:-mingyu-server}"
APP_DIR="${MINGYU_APP_DIR:-/zhunming-next}"
PORT="${MINGYU_APP_PORT:-3200}"
MARKER="${MINGYU_MARKER:-}"
KEEP_BACKUPS=3
STAMP="$(date +%Y%m%d-%H%M%S)"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
TARBALL=".sync-dist.tar.gz"

log() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { printf '\n!! %s\n' "$*" >&2; exit 1; }

# ---------- 1. 构建 ----------
case "$MODE" in
  --no-build) log "1/4 跳过构建，沿用现有 dist/" ;;
  --full)     log "1/4 完整构建（pnpm run build）"; corepack pnpm run build ;;
  "")         log "1/4 快速构建（node scripts/run-vite-build.mjs）"; node scripts/run-vite-build.mjs ;;
  *)          die "未知参数：$MODE（可用 --full / --no-build）" ;;
esac
[ -f dist/index.html ] || die "缺少 dist/index.html，构建未产出"

# ---------- 2. 打包 ----------
log "2/4 打包 dist/"
rm -f "$TARBALL"
tar -czf "$TARBALL" -C dist .
log "   包大小 $(du -h "$TARBALL" | cut -f1)"

# ---------- 3. 上传并替换 ----------
log "3/4 上传到 $HOST，替换 $APP_DIR/dist"
scp -q "$TARBALL" "$HOST:/root/mingyu-dist.tar.gz"
ssh "$HOST" "
set -euo pipefail
cd '$APP_DIR'
if [ -d dist ]; then mv dist 'dist.old-$STAMP'; fi
mkdir -p dist
tar -xzf /root/mingyu-dist.tar.gz -C dist
rm -f /root/mingyu-dist.tar.gz
ls -1d dist.old-* 2>/dev/null | sort | head -n -$KEEP_BACKUPS | xargs -r rm -rf
echo \"   dist 已替换，保留备份 \$(ls -1d dist.old-* 2>/dev/null | wc -l) 个\"
"
rm -f "$TARBALL"

# ---------- 4. 验收（以线上为准，不以 dev 为准）----------
log "4/4 验收"
ssh "$HOST" "curl -s -o /dev/null -w '   /api/app/health -> %{http_code}\n' http://127.0.0.1:$PORT/api/app/health"
ssh "$HOST" "curl -s -o /dev/null -w '   首页 /          -> %{http_code}\n' http://127.0.0.1:$PORT/"

if [ -n "$MARKER" ]; then
  CSS="$(ssh "$HOST" "curl -s http://127.0.0.1:$PORT/ | grep -o 'assets/index-[A-Za-z0-9._-]*\.css' | head -1")"
  JS="$(ssh "$HOST" "curl -s http://127.0.0.1:$PORT/ | grep -o 'assets/index-[A-Za-z0-9._-]*\.js' | head -1")"
  [ -n "$CSS" ] && [ -n "$JS" ] || die "取不到线上资源名，首页可能没正常渲染"
  HIT_CSS="$(ssh "$HOST" "curl -s http://127.0.0.1:$PORT/$CSS | grep -c '$MARKER' || true")"
  HIT_JS="$(ssh "$HOST" "curl -s http://127.0.0.1:$PORT/$JS | grep -c '$MARKER' || true")"
  log "   标记 '$MARKER'：CSS($CSS)=$HIT_CSS  JS($JS)=$HIT_JS"
  if [ "$HIT_CSS" = "0" ] && [ "$HIT_JS" = "0" ]; then
    die "线上产物里找不到标记 '$MARKER'，本次改动可能没进包"
  fi
else
  log "   未提供 MINGYU_MARKER，跳过标记检查（下次建议：MINGYU_MARKER=你的新类名）"
fi

log "完成"
