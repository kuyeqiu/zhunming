# Agent Note: UI 迭代改走「静态草稿 + 评审面板」

Status: implemented

## Problem

前几轮 UI 都是**直接在 React 里改 CSS，然后靠我截图自评**。结果连续两次返工：一次是"只换皮没换骨"被用户直接指出，一次是改完只在 dev 验收、线上停在旧包。根因相同——**评审发生在我的截图里，而不是在用户的浏览器里**，我看到的和用户看到的是两件事，而且用户只能用自然语言描述"哪里丑"。

## Decision

引入 `ui-design-iteration` 技能的工作流，UI 改动分两段：

**第一段：草稿区（不碰 React）**

- 目录 `drafts/<surface>/`，一页静态 HTML + 内联样式，**离线可开、无构建**；
- `:root` 里放十三个杠杆（`gap / fs / ratio / measure / radius / hue / ink / surface / line / edge / shadow / room / dur`），所有可调值从它们推导；
- 每个 section / component 根节点带 `data-node="surface/block#i"` 锚点；
- `design-contract.md` 记录杠杆来源、已定决策、样本值、锚点表、明确不做的部分；
- `draft-kit.js` + `DRAFT_KIT` 配置挂评审面板，`scripts/draft_server.py` 提供静态服务并把 `POST /__select` 写进 `selection.json`。

**第二段：收敛后移植**

用户点选元素、拖滑块、留批注 → 我读 `selection.json` → 只交付**针对该锚点的补丁** → 截图前后对比 → 收敛后我才把成品移植回 React 的对应页面。

第一批落地的是结果页：`app/drafts/result-page/`（单列窄栏 + 折叠，杠杆全部由既有 ink token 换算，未引入新色）。

## Alternatives considered

1. **继续在 React 里改 + 我截图自评**：最省事，但正是它导致了两次返工；用户无法精确指认元素，我也无法验证"用户看到的那一版"。
2. **在 React 里挂 Storybook 之类的隔离环境**：能逐个组件评审，但需要构建、需要把水墨 token 搬进 story 环境，且用户仍然只能看截图。
3. **让用户直接改 CSS 再交给我**：跳过沟通成本，但要求用户懂这套 token，且改动无法追溯。
4. **只做静态原型、不做移植**：交付物停在草稿，线上永远是旧 UI —— 这正是上一轮"服务器没变化"的另一种翻版。

## Consequences

- 收益：评审发生在用户真实浏览器里；意见落成结构化快照（选择器 / 计算样式 / 对比度 / 滑块值 / 视口宽度），不再靠形容词；补丁粒度到锚点，不会顺手改坏邻居。
- 收益：草稿无构建、离线可开，任何时候都能重开对照，不依赖 dev server 与依赖树。
- 代价：一个 surface 要多一轮"草稿→评审→移植"，比直接改 CSS 慢；只有值得反复打磨的页面（结果页、首页）才划算。
- 代价：评审需要用户动手（点选、拖滑块），不是发一句话就行。
- 代价：草稿与 React 实现是两份代码，移植时必然有偏差，需要以草稿为准重写样式而不是复制。
- 未做：草稿尚未跑对比度/键盘/目标尺寸审计（`references/audit.md`）；移动端断点未设计。
- 验证：草稿在 `http://127.0.0.1:7450/result.html` 渲染正常，面板在右下角可交互；1180/1280 两个宽度截图检查过四柱换行与岁运标签。
