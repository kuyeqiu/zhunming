# Agent Note: 水墨视觉系统落地为可复用的 token 与原子

Status: implemented

## Problem

上游 `c98044ab` 的首页已有一版水墨场景（`workspace-home-ink-scene`：观象/知命竖排、玄览印、人形 SVG），方向对但执行不到位：人形是纯黑剪影，笔画等宽、无浓淡、无飞白，读起来像皮影图标；同时全站强调色是粉色（`--accent: #de5aa6`），与宣纸米白直接冲突，侧栏与选中态是最重的「后台感」来源。设计目标要求「好看优先」，而现有 400KB+ 的四份 CSS 里没有任何可复用的设计基座。

## Decision

新增一层纯增量的水墨基座，不动既有 `--accent*` 体系，逐页迁移。

- `src/styles/ink-tokens.css`：`--paper-*` / `--ink-*` / `--cinnabar` 三组变量，加字阶、字距、节奏、动效与 `.ink-*` 组件类。所有类名以 `ink-` 前缀，禁止重置全局标签选择器，避免污染 `workspace-*`。
- 新增 `ink` 主题（`WorkspaceThemeId` 第 6 项），并把 `DEFAULT_WORKSPACE_PREFERENCES.theme` 改为 `ink`：朱砂 `#9e2a2b` 作为全站唯一强调色，`--surface-*` 一律向纸靠拢，避免纯白卡片把版面切成表格。暗色变体为「夜墨」，在 `prefers-color-scheme: dark` 下单独定义。
- `src/components/ink/InkArt.tsx`：枯笔飞白与渗墨用 SVG 滤镜（`feTurbulence` + `feDisplacementMap`）实现，不用位图。笔画用 `currentColor`，主题切换自动跟随，体积只有几百字节。两个主视觉：`shadow`（孤影长行，行者 + 由浓转淡的长影）与 `eye`（水墨观眼）。
- `InkFilters` / `PaperGrain` 在 `App.tsx` 挂一次；纸纹层 `position: fixed` 且 `pointer-events: none`，不吃事件。
- 首屏主视觉换成 `InkMotif name="eye"`：上下眼睑交于内外眼角、四笔睫毛、破墨圆相瞳仁（`strokeDasharray` 留缺）、朱砂瞳心、两笔散逸与一滴悬墨。瞳仁 90s 极缓自转，`prefers-reduced-motion` 下全部关闭。
- 首页问答区在 ink 主题下改为「纸面直写」：去掉卡片边框/圆角/阴影，换成上下两道细线；底部 chips 由胶囊改虚线小签。这些覆盖全部限定在 `:root[data-accent-theme='ink']` 下，其他配色保持上游形态，互不干扰。

### 字体：自托管子集，不引 CDN

原先靠系统字体栈，Windows 回退 SimSun 时笔画过细、标题失去书卷气。现在用 fonttools 把 Noto Serif SC 子集化到**界面用字**（`src/` 与 `rag/` 中出现的 1481 个汉字 + ASCII + 中文标点，共 1630 字），输出 `public/fonts/mingyu-serif-{400,600}.woff2`，约 305KB/字重，`font-display: swap`，`index.html` preload 400 字重。

不引 Google Fonts：大陆可达性不可靠，首屏不该依赖外部域名；也不下载完整字体（2MB/字重，移动端首屏代价过大）。

代价是子集外的字会回退。为避免**段内跳字体**，拆两条字体栈：`--ink-font-serif`（标题、导航、标签，用子集）与 `--ink-font-reading`（长正文，只用系统宋体，不掺子集）。

### 侧栏：从分段控件改回书目

`.workspace-sidebar-switch` 原本是灰底分段胶囊 + 选中粉底，是整页最重的「后台感」。改为纯文字 + 选中一道朱砂下划线；`.workspace-nav-mark` 的灰底圆角方块改为 1px 细线方框（选中转朱砂），`.workspace-nav-label` 字重由 750 降到 400 并加宽字距，侧栏底色转透明 + 右侧一道细线。
### 与上游局部水墨变量并轨

`new/-` 带着一份未提交的本地改动：`src/workspace.css` 里 412 行「水墨首页视觉层」，自带 `--home-paper / --home-paper-deep / --home-ink / --home-ink-soft / --home-cinnabar` 五色，被 26 处引用。

处理方式不是删掉重写，而是**把五个变量接到统一 token**（`--home-paper: var(--paper-bg)` 等）。理由：那 412 行同时管着首页背景渐变与主视觉比例，删掉会连带丢失版式；接一下即可让全站只有一个色值来源，且跟着 ink 主题的暗色变体自动走。

### 表单控件：一套底线语言贯穿输入页

输入页原先由「白卡片 + 圆角输入框 + 滑动胶囊分段控件」组成，是典型的后台表单观感。改为：

- `.workspace-ui-form-surface` 去边框、去圆角、去阴影、去内边距，卡片变纸面；
- `.workspace-ui-control` 与 `.workspace-ui-dropdown-trigger` 统一成「无框 + 一条底线」，聚焦时底线转朱砂；
- `.workspace-ui-segmented` 隐藏滑动指示器（`display: none`），选项改文字 + 选中一道朱砂下划线；
- `.workspace-case-tab*` 顶部粉底胶囊改细线小签，`临` 字转朱砂；
- 按钮一律方角细线，主按钮悬停时反白为焦墨底。
### 结果页：只改「纸、线、字」，不动结构

结果页 `ResultPage/index.tsx` 有 3731 行，四柱/藏干/纳音/神煞/岁运全部由 grid 与嵌套组件构成。这一轮不重构 DOM，只做主题内覆盖：

- `.bazi-pillars-table` 去单元格边框与斑马底，改为上下两道焦墨横线 + 单元格间虚线；`.is-head/.is-label` 转淡墨宽字距；
- 干支字号提到 1.55rem、衬线 600，`.is-day-master` 由整块底色改为左右两道朱砂细边；
- **五行着色全部收墨**：上游给干支按五行上色（棕/蓝/绿/红/黄），五种饱和色同屏纸面立刻碎掉。水墨版一律 `[data-wuxing] { color: var(--ink-deep) }`，只靠浓淡分层，朱砂只留给日主一列——全盘唯一重音；
- `.fortune-item.active` 由填充色改朱砂底线；`.result-side-card` / `.fortune-selector-card` 去圆角去阴影；
- `.result-summary-grid > *` 由色块改「左侧一道墨线」的批注形态。

未动的一处（已知问题）：右侧「提示词」面板占约 1/3 宽度、内容是给模型用的 prompt，属于工具属性泄漏到 C 端界面。它是组件级存在，CSS 无法既隐藏又不留空列，需要改 `ResultPage` 的布局条件，留待下一轮。
### 账户页：把表单语言复用到底

`/account` 未登录是「入册」页，已登录是账户概览（余额 / 有效权益 / 订单数 → 票券兑换 → 权益列表 → 订单列表）。

没有新建视觉体系：登录注册直接复用 `.ink-field` 与 `.ink-btn`，权益与订单是 `.ink-note` 那条「左侧墨线 + 虚线分隔」的语言，统计数字用衬线大字（像碑上的计数），过期权益整行降到 45% 透明度表达「已失效」而不是换颜色。

侧栏页脚的「我的 / 使用说明 / 设置」原本是胶囊按钮，选中是粉底；改为朱砂下划线，与「工具 / 历史」一致。

本地开发需要业务后端：`vite.config.ts` 加了 `server.proxy['/api/app']`，默认指向 `http://127.0.0.1:3100`（可用 `MINGYU_APP_API_ORIGIN` 覆盖）。生产环境同源，由 `server/docker-server.ts` 直接处理，不走代理。
## Alternatives considered

1. **直接用位图水墨素材**：质感最真，但体积大、无法跟随主题换色、暗色模式要再出一套，且后续每个页面都要配图。
2. **保持粉色强调色、只换背景为纸色**：改动最小，但粉 + 宣纸正是当前廉价感的来源，等于没解决。
3. **引入 Tailwind / 组件库重建样式层**：能一次解决 400KB 散乱 CSS，但会与上游 605 个提交的样式结构彻底分手，后续同步变成人工合并。
4. **把水墨做成独立路由的落地页**：视觉最自由，但与产品动线脱节（用户来是为了排盘，不是看首屏），且首页仍丑。
5. **重写 `workspace.css` 里的 ink-scene 与 composer 原有规则**：更干净，但会破坏其他配色主题下的既有表现，回滚成本高。

## Consequences

- 收益：水墨方向有了可复用的变量与原子，后续「结果页」「输入页」可以只换组件不重画；主题可切换、可回滚（`ink` 只是第 6 个选项）。
- 代价：目前是「双轨」——`ink` 主题下部分区域仍是上游样式（侧栏分段控件、图标底色、功德箱按钮），视觉不统一会显得半成品，需要逐页补齐。
- 代价：枯笔滤镜依赖 SVG filter，低端 Android 上大面积使用会掉帧，所以只用在主视觉与小面积文字，不铺到列表。
- 未解决：中文衬线字体依赖系统字体栈。Windows 回退到 SimSun 时笔画偏细，「书卷气」打折；要真正稳定，需自托管思源宋体子集（未做）。
- 验证：`pnpm typecheck:app` 通过；`pnpm dev` 下首页渲染正常（截图对比：纯黑剪影 → 有飞白层次的水墨眼；粉色强调 → 朱砂）。
