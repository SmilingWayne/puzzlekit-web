# PuzzleKit Web 项目指南（中文）

## 1. 项目目标

PuzzleKit Web 是一个前端优先的逻辑谜题推理工作台，核心目标是：

- 将谜题 URL 解析为统一的浏览器端 IR（不依赖后端）。
- 使用非 SAT 的规则推理引擎，逐步推导。
- 实时可视化盘面状态与推理过程。
- 为多谜题扩展提供统一架构（当前 Slitherlink，后续 Masyu / Nonogram）。

产品重点是**可解释推理**，不是黑箱求解。

---

## 2. 技术栈与工具链

- **语言**：TypeScript
- **前端框架**：React 19
- **构建工具**：Vite
- **路由**：React Router
- **状态管理**：Zustand
- **运行时校验**：Zod
- **测试**：
  - 单元/组件：Vitest + Testing Library
  - 端到端：Playwright
- **代码质量**：ESLint + Prettier + lint-staged + Husky

根目录 `package.json` 常用命令：

- `npm run dev`：本地开发
- `npm run build`：生产构建
- `npm run preview`：预览构建产物
- `npm run lint`：静态检查
- `npm run test:run`：运行单测/组件测试
- `npm run test:e2e`：运行端到端测试

---

## 3. 当前架构总览

```text
src/
  app/              # 页面编排与布局
  domain/           # 纯业务/谜题逻辑核心
    ir/             # IR 类型与键值工具
    parsers/        # URL 编解码适配器
    rules/          # 推理规则与规则引擎
    plugins/        # 谜题插件契约与注册
    exporters/      # 导出抽象层
    difficulty/     # 难度统计快照（派生）
  features/         # 功能模块 UI（盘面、控制、统计、步骤）
  test/             # 测试环境初始化
```

架构原则：

- 盘面渲染与推理逻辑分离。
- 谜题差异放在插件/领域层，不散落在 UI 层。
- 每一步推理都要产出 diff，保证可回放、可解释。

---

## 4. 核心代码修改入口

### 4.1 推理引擎

- 规则执行主循环：`src/domain/rules/engine.ts`
- 规则/步骤数据结构：`src/domain/rules/types.ts`
- Slitherlink 规则集合：`src/domain/rules/slither/rules.ts`
- 时间线状态（next/prev/solve/reset）：`src/features/solver/solverStore.ts`

新增规则建议顺序：

1. 先写 puzzle 专属规则文件
2. 在插件 `getRules()` 中接入
3. 补对应测试

### 4.2 编解码

- 统一入口：`src/domain/parsers/index.ts`
- Slitherlink puzz.link 编解码：`src/domain/parsers/puzzlink/slitherPuzzlink.ts`
- Penpa 适配器占位：`src/domain/parsers/penpa/index.ts`（暂未实现）

### 4.3 Canvas 盘面渲染

- 盘面渲染与视图交互（缩放/拖拽）：`src/features/board/CanvasBoard.tsx`
- 注意：谜题操作型交互（如点边、涂格）当前尚未完整实现。

### 4.4 页面布局与交互面板

- 主页面布局：`src/app/WorkspacePage.tsx`
- 样式与布局：`src/app/workspace.css`
- 输入/控制/导出面板：`src/features/solver/ControlPanel.tsx`
- 推理步骤展示：`src/features/explanation/ExplanationPanel.tsx`
- 统计面板：`src/features/stats/StatsPanel.tsx`

### 4.5 插件化扩展

- 插件契约：`src/domain/plugins/types.ts`
- 插件注册：`src/domain/plugins/registry.ts`
- 已实现：`src/domain/plugins/slitherPlugin.ts`
- 预留：`src/domain/plugins/masyuPlugin.ts`、`src/domain/plugins/nonogramPlugin.ts`

---

## 5. 当前功能状态

已完成：

- Slitherlink puzz.link 基础编解码
- 规则推理流程（`Next` / `Previous` / `Solve to End`）
- 时间线回退可靠性修复（回退后再前进不会错误堆积）
- 步骤展示模式（`Recent 30` / `Show All`）
- 推理步骤按“最新在上”展示
- 导出面板（可折叠）：
  - puzz.link 导出
  - penpa 占位导出
  - 规范化 JSON 导出
  - 复制到剪贴板

部分完成 / 占位：

- Penpa 真正编解码逻辑
- Slitherlink 之外的规则体系
- 谜题类型差异化交互工具
- 难度量化模型（当前仅结构统计）

---

## 6. 推荐开发流程

1. 小步修改，范围明确。
2. 优先补测试或同步调整测试。
3. 每次变更后执行：
   - `npm run lint`
   - `npm run test:run`
   - `npm run build`
4. 涉及关键 UI 流程时可补跑 E2E：
   - 首次：`npx playwright install`
   - 执行：`npm run test:e2e`

---

## 7. 部署说明

- 构建产物目录：`dist/`
- 当前能力可按纯静态站点部署（Vercel / Netlify / Nginx 静态托管等）
- 不需要后端运行时

---

## 8. 待开发事项与优先级建议

高优先级：

1. 完成 Slitherlink 的 Penpa 编解码。
2. 建立“插件定义交互行为”契约。
3. 扩展 Slitherlink 规则覆盖率并保证规则顺序稳定。

中优先级：

1. 导出结果校验与格式状态提示。
2. 难度模型校准。
3. 步骤解释元数据增强（规则分类、影响对象等）。

低优先级：

1. 主题与可访问性优化。
2. 大盘面性能优化。

---

## 9. 给 AI 智能体 / 新协作者的协作约束

建议遵循：

- `domain/` 是谜题行为真源，不在 UI 层写谜题逻辑。
- 不要把 puzzle-specific 逻辑直接塞到 `CanvasBoard.tsx`。
- 每条规则必须输出可重放 diff 与可解释文本。
- 维护时间线语义一致性（`steps + pointer`）。
- 修改逻辑时必须补或更新 `*.test.ts` / `*.test.tsx`。

新增谜题建议路径：

1. 新增 parser/encoder 适配器
2. 新增并注册 puzzle plugin
3. 新增规则集及测试
4. 通过插件可配置项引入专属文案或展示，不直接硬编码在通用 UI 中

