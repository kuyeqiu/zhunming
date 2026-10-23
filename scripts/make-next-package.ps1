# 打包新版部署包（Windows 本地执行）
#   产出：..\mingyu-next.tar.gz
#   只带运行期需要的东西：构建产物、服务端、核心包 dist、字体、RAG 语料。

$ErrorActionPreference = 'Stop'
$root = 'E:\Daima\mingyu\app'
$out = 'E:\Daima\mingyu\mingyu-next.tar.gz'

Push-Location $root
try {
  if (Test-Path $out) { Remove-Item $out -Force }

  $include = @(
    'dist',
    'packages/core/dist',
    'packages/core/package.json',
    'server',
    'src',
    'functions',
    'public',
    'rag',
    'patches',
    'mcp',
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'tsconfig.json',
    'tsconfig.app.json',
    'tsconfig.node.json',
    'tsconfig.server.json',
    'index.html',
    '.env.next.example',
    'deploy-next.sh'
  )

  $missing = $include | Where-Object { -not (Test-Path $_) }
  if ($missing) { throw "缺少必要路径: $($missing -join ', ')" }

  tar -czf $out `
    --exclude='node_modules' `
    --exclude='*/node_modules' `
    --exclude='.git' `
    --exclude='.agents' `
    --exclude='.tmp-build' `
    $include

  $size = [math]::Round((Get-Item $out).Length / 1MB, 1)
  $md5 = (Get-FileHash $out -Algorithm MD5).Hash.ToLower()
  "打包完成: $out"
  "  体积: $size MB"
  "  md5 : $md5"

  # 包内清单抽查
  $list = tar -tzf $out
  "  条目: $($list.Count)"
  foreach ($probe in @('dist/index.html', 'server/app/index.ts', 'packages/core/dist/index.js', 'public/fonts/mingyu-serif-400.woff2', 'deploy-next.sh')) {
    $hit = $list | Where-Object { $_ -eq $probe -or $_ -eq "./$probe" }
    "  $(if ($hit) { 'ok  ' } else { 'MISS' }) $probe"
  }
}
finally {
  Pop-Location
}
