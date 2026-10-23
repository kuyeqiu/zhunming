# Agent Note: UI 换骨（去侧栏 + 顶部导航 + 水墨罗盘）

Status: implemented

## Problem

上一轮只做了「换皮」：加水墨 token、把侧栏和表单改成下划线风格。用户判断得准——**骨架没动**，仍是上游的「248px 常驻侧栏 + 边际主区」。同时暴露一个具体缺陷：`styles.css` 的 `prefers-color-scheme: dark` 会把外壳刷深，而账户页 `.ink-page` 的背景硬写浅色 `--paper-bg`，其暗色变体只在 `[data-ink-mode='dark']` 下生效、而这个属性无人设置，于是深色系统下出现「黑侧栏 + 白纸块」的割裂。

## Decision

**1. 主题：只认显式选择，不跟随系统**

- `src/lib/ink-theme.ts`：读写 `documentElement.dataset.inkMode`（`light`/`dark`），持久化到 `localStorage['mingyu.ink.mode']`，`main.tsx` 启动时应用；
- 删除 `styles.css` 中 ink 的 `@media (prefers-color-scheme: dark)` 块，暗色只由 `[data-ink-mode='dark']` 触发；
- 理由：宣纸底是这套设计的核心表达，跟随系统会让一半用户看到没调过的暗色。

**2. 骨架：顶栏取代侧栏**

- 新增 `src/components/ink/InkTopBar.tsx`：品牌章 + 排盘/占问/历法/我的（≤5 项）+ 工具（开抽屉）+ 夜（切换主题）；
- ink 主题下 `.workspace-sidebar` 与 `.workspace-mobile-header` 隐藏，`.workspace-main` 的 `margin-left: 248px` 归零并 `padding-top: 64px`，`.workspace-case-tabbar` 的 sticky 顶部同步下移；
- 工具全集仍在 `workspace-mobile-drawer` 里，「工具」按钮打开——去侧栏不丢功能，只是把「墙」藏到一次点击之后。

**3. 首页主视觉：水墨罗盘**

`InkMotifName` 增加 `compass`：三环结构（外环 24 山刻度按 15° 长短交替、中环八字方位 子艮卯巽午坤酉乾、内环朱砂虚圆留缺），中心一点朱砂。**不承担导航**——它只是注视的中心。

**4. 顺带清理的重复**

- 首页页内那个「命」方框（`.workspace-home-brand`）与顶栏品牌章重复 → 隐藏；
- 功德箱从方框按钮改细线小签；
- 标题层：本地遗留的 412 行样式把 `.workspace-home-heading` 改成了 `grid 1fr auto 1fr`，品牌隐藏后标题掉进左列 → 在 ink 主题下强制 `display: flex` 单列居中。

## Alternatives considered

1. **罗盘承担导航（盘面即入口）**：最独特，但可发现性差——用户不知道盘上有什么，也找不到「大六壬」这类冷门项；且需要大量 SVG 交互与无障碍兜底，风险集中在最不该冒险的首屏。
2. **保留侧栏但改成「书目录」形态**：信息密度好，但骨架仍是侧栏，用户已明确说「跟原来一样」。
3. **跟随系统的明暗双主题全做**：体验最现代，但暗色下要把「纸」重新设计成「墨底反白」，等于再做一套设计。
4. **只修暗色 bug、不动骨架**：成本最低，但不解决诉求。
5. **引组件库（Ant Design / shadcn）重建**：观感一致得快，但会把水墨质感磨平，且与上游 605 个提交的样式结构彻底分手。

## Consequences

- 收益：首屏无侧栏，信息层级从「左窄栏 + 右内容」变成「一条顶栏 + 单轴内容」，与上游彻底区分开；明暗割裂消除；罗盘成为可记忆的视觉锚点。
- 代价：`workspace.css` 里那份 412 行本地水墨层与新 token 仍是双轨——它定义了 `.workspace-home-heading` 为 grid、`.workspace-home-page` 的背景渐变等，每次覆盖都要先读它（本轮就漏了 `display`，标题错位一轮才发现）。
- 代价：去掉侧栏后，冷门工具（太乙、皇极经世）的曝光进一步依赖抽屉；抽屉本身还没重做，仍是旧的侧栏样式。
- 未做：结果页的「单列窄栏 + 详情折叠」（信息最密的一页，需逐块决定默认露出什么）；案例管理按钮、输入页「＋」按钮仍是方框；抽屉质感未改。
- 验证：`tsc` 通过、`pnpm build` exit 0；截图确认首页（顶栏 + 罗盘 + 竖排题字 + 纸面问答）与 `/account`（浅色不再出现黑侧栏）、`/chart/bazi`（顶栏与案例页签不重叠）。
