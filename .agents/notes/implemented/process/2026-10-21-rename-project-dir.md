# Agent Note: 项目目录从 `new/-` 改名为 `app`

Status: implemented

## Problem

项目目录原本叫 `new/-`（单个连字符）。这个路径已经造成三次事故，且每次都表现为"看起来不该出错的地方出错了"：

1. **相对路径写进别的工程**：`Set-Location 'E:\Daima\mingyu\new\-'` 静默失败后落在 `E:\Daima\mingyu`，随后 `src\App.tsx` 的相对写入命中了**旧工程**，把两行无关的 `<Route path="/admin">` 注入到用户自己的 `BillingAdminPage` 定制旁边。
2. **游离目录**：拼路径时写成 `new\-.agents`（少一层分隔符），在 `new\` 下生成了一个独立的 `-.agents` 目录，笔记第一次落位失败。
3. **预览器路径折叠**：DSH 文件预览把 `new/-/board-full.html` 折叠成 `new\-board-full.html`，报 `ENOENT`，而文件本身 `Test-Path` 两种写法都正常。

根因是同一个：`-` 在大量路径处理里被当作参数前缀或分隔符，任何做过 `split('/')`/`join` 或按 `-` 切分参数的代码都会吃掉它旁边的分隔符。

## Decision

目录改名为 `E:\Daima\mingyu\app`，并同步更新所有写死绝对路径的地方（共 3 处）：

- `scripts/make-next-package.ps1` 的 `$root`
- `DEPLOY-NEXT.md` 的示例命令
- `.agents/notes/implemented/process/2026-10-21-ui-changes-not-deployed.md` 里的路径

`.git` 随目录移动，提交历史不受影响；服务器侧部署路径是 `/zhunming-next`，与本地目录名无关，因此线上无需任何改动。

## Alternatives considered

1. **保留目录名，产物一律写到外面**（例如看板放 `E:\Daima\mingyu\`）：能绕开预览器，但每次构建脚本、笔记、命令都要记得"不要放进项目目录"，属于靠纪律对抗工具缺陷。
2. **建一个 `-` 的 junction 指向 `app`**：旧路径兼容，但把病态名字永久留在系统里，且 junction 自身也可能被同样的折叠规则坑到。
3. **不改名，只改用 `file://` 绝对 URI**：解决预览这一个症状，前两次事故（写错工程、游离目录）依然随时复现。

## Consequences

- 收益：整类路径折叠/切分问题消失；`Set-Location` 不再静默失败；笔记与脚本里的绝对路径可以正常书写。
- 代价：任何**仓库之外**写死 `new\-` 的引用会失效（IDE 工作区、快捷方式、用户自己的脚本），这些无法被 `git grep` 发现，只能由使用者自行更新。
- 代价：`E:\Daima\mingyu\new` 空目录已删除，若有人记得旧路径会扑空。
- 验证：改名后 `git log -1` 仍是 `c98044ab`（历史完整）、`git status` 正常；`tsc --project tsconfig.app.json` 与 `tsc --project tsconfig.server.json` 均通过；`pnpm build` exit 0；全仓 `rg 'mingyu\\new\\-|mingyu/new/-'` 无残留命中。
