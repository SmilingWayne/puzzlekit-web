# Masyu 规则差距与融合路线

这份文档把 `Puzzlink_Assistance.js` 的 Masyu 思路和当前 PuzzleKit Masyu 规则栈放在一起比较。目标不是把作者脚本原样搬进来，而是判断哪些技巧适合拆成 replay-safe、step-wise、可解释的规则。

## 当前两套实现的定位差异

作者脚本的定位是“在 puzz.link 页面上快速辅助推导”。它直接写 puzz.link board 状态，规则之间没有清晰边界，只要能推出线、叉或顶点颜色，就立刻写入并继续下一轮。

PuzzleKit 的定位是“纯前端、分步、可解释的推理工具”。当前 Masyu 规则通过 `RuleApplication` 返回 diff，每一步需要说清楚为什么改了哪些线或 tile。这让规则更容易回放、测试和解释，但也意味着不能简单复制作者那种大而混杂的 assist 循环。

这个差异决定了推荐路线：**吸收作者的推理思想，不吸收作者的 monolithic 结构**。

## 当前 PuzzleKit 的优势

PuzzleKit 已经有几块作者脚本没有的能力：

- **可解释回放**：每条规则返回明确的 `LineDiff` / `TileDiff`，有 message、affected cells/lines/tiles。
- **结构化候选模型**：黑珠、白珠都有候选 pruning 的基础设施，不只是硬编码 pattern。
- **bounded strong inference**：已有黑珠和白珠强推断，能用有限 trial propagation 排除导致矛盾的局部假设。
- **相邻白珠 lookahead**：`Adjacent White Pearls LookAhead` 把相邻白珠的两类穿法作为结构化候选，而不是只写坐标 pattern。
- **tile parity 基础设施**：`PuzzleIR.tiles` 已经把 Masyu 的 inside/outside 思想落成 vertex-centered tile，可以承接作者的 in/out 推理。
- **line graph 基础设施**：已有 premature loop、known line components、candidate graph、bridge line 等基础工具。

因此，后续不需要把精力放在“补一个通用搜索器”上。更高收益的是补齐作者脚本里那些便宜、确定、可解释的 topology 和 pattern 结论。

## 当前缺口

### 1. SingleLoopInCell 的 loop-graph 细节还没有完全等价物

PuzzleKit 已有 `Prevent Premature Loop`，也有 `Candidate Bridge Line`，但作者 `SingleLoopInCell()` 里还有不少更细的单环推理：

- 必须经过格只剩两条候选边时的强制；
- 当前路径分量会在某格自连时的排除；
- 某个必须经过格是连接两个候选路径组的唯一入口时的强制；
- 使用 `lineaux` 临时可能线判断候选路径组；
- 长路径分量与局部空格之间的“包围/反弹”推理。

其中有些可能已经被 `Cell Completion`、`Pearl Completion` 或候选 pruning 间接覆盖，但还没有形成一套清晰的“单环通用图规则”。

### 2. 连通性框架拆得更可解释，但能力不如作者集中

当前 PuzzleKit 把连通性拆成两类：

- `Candidate Bridge Line`：在候选 line graph 中找桥边，强制连接 required sources。
- `Tile Connectivity Cut Coloring`：在 tile color graph 中找 cut / unreachable 区域，推出 inside/outside 颜色。

作者的 `CellConnected()` 则是一个更泛化的 low-link 框架，可以根据配置同时做 cut vertex、bridge、不可达、强制连接。PuzzleKit 的拆分更符合解释性，但目前少了几个能力：

- required-source articulation：某个候选 cell/component 是连接多个必达源的割点；
- candidate cut vertex 周围的线决策：不仅知道“这里必须通过”，还要转换成哪些边必须线/叉；
- bridge 与 pearl-local 约束结合：桥边不是孤立判断，而是会触发黑珠/白珠的出口选择。

### 3. in/out 颜色传播还可以更主动

作者把顶点 in/out 颜色和线/叉判断放得很近：

- 同色顶点之间是叉；
- 异色顶点之间是线；
- 白珠对角顶点异色；
- 部分黑白组合直接推出顶点颜色关系；
- 颜色一旦传播，又马上反推线/叉。

PuzzleKit 已经有 `Tile Color Propagation`、`Color-Pearl Propagation`、`Color-Line Propagation`，但仍偏“基础 parity”。缺少的主要是：

- 更多 pearl-local tile color implication；
- linegraph 或 candidate graph 触发的 tile color implication；
- 把作者某些 cross qsub 结论稳定翻译成 `PuzzleIR.tiles` 的规则。

### 4. 部分高收益 pattern 尚未覆盖

当前已有 `Black Facing Consecutive Whites`、`Black Diagonal White Pinch`、`Consecutive White Pearls Straight`、`Double Black Squeeze`、相邻白珠 lookahead 等规则。

作者脚本中仍有一些值得补的 pattern：

- 白珠某轴两侧都无法满足相邻转弯时，强制走另一轴；
- 双黑夹迫的更宽条件，不只是一条垂直边已 blank；
- 黑珠出口被第二段、邻近黑珠、边界或白珠形态排除时的即时结论；
- 长走廊 linegraph + 两个白珠 / 黑白组合导致的强制延伸；
- 已知路径分量触发的 “connectivity and black” / “connectivity and white”。

这些最好不要一次性堆成一个 `patterns.ts` 巨块，而是按“解释能否一句话说清楚”拆成小规则。

## 候选规则清单

| 作者技巧 | 当前状态 | 建议 |
| --- | --- | --- |
| 白珠已有一侧线后强制直行、垂直打叉 | 已覆盖主干 | 保持在白珠基础规则中 |
| 白珠一侧已连续直行两段，另一侧不能继续直行 | 部分覆盖 | 用白珠候选模型校准后保留/补测试 |
| 白珠某轴两侧都不能完成相邻转弯，强制另一轴 | 部分覆盖 | 优先补成 `White Pearl Axis Feasibility` 类规则 |
| 黑珠已有出口后强制第二段直行 | 已覆盖主干 | 保持在黑珠基础/候选规则中 |
| 黑珠某出口因第二段不可走或邻近珍珠形态不可用而排除 | 部分覆盖 | 优先进入黑珠候选 pruning，而不是硬编码多个 if |
| 双黑夹迫 | 已有窄版 | 扩展条件，保留清晰 fixture |
| 黑珠面对两个连续白珠 | 已覆盖 | 检查作者远端/变体是否还缺 |
| 黑珠被两个斜向白珠 pinch | 已覆盖 | 保持现状，补充必要测试即可 |
| 连续三白珠强制垂直于 run | 已覆盖 | 保持现状 |
| 相邻白珠两种穿法只剩一种 | 已有 lookahead | 当前实现比作者更结构化，继续沿用 |
| 同一路径分量提前闭环打叉 | 已覆盖主干 | 扩展到更多局部自连形态 |
| 必须连通源之间的桥边强制线 | 已覆盖桥边 | 扩展到 articulation/cut vertex |
| 顶点 in/out 同色叉、异色线 | 已覆盖基础 parity | 增加更多触发颜色的来源 |
| 白珠对角顶点异色 | 已覆盖 | 保持在 color-pearl propagation |
| 黑白组合触发顶点颜色传播 | 未充分覆盖 | 作为 tile color 小规则补充 |
| linegraph 触发的黑珠/白珠方向选择 | 未充分覆盖 | 高优先级，适合单独成规则 |
| 作者的通用深度搜索/强推断 | 作者没有 | 不作为移植目标，保留 PuzzleKit 现有强推断 |

## 推荐实现路径

### 第一步：先整理成规则族，不直接移植

先把作者脚本中的结论分成三类：

- 已有规则覆盖，只需要补测试或改说明；
- 当前规则部分覆盖，可以用候选模型或 graph helper 扩展；
- 真正缺失，需要新增小规则。

这一步的关键是避免把 `MasyuAssist()` 重新写成一个新的大函数。每条规则都应有一个简短、可复述的理由。

### 第二步：优先增强 line graph 层

建议先扩展 `lineGraph.ts` 的表达能力，而不是继续堆坐标 pattern：

- required sources 继续由珍珠和已知线分量提供；
- candidate graph 继续由所有非 blank 线构成；
- 在 bridge edge 之外，增加 articulation / cut vertex 分析；
- 提供“某个候选 cell/component 必须被通过”的结果，再由上层规则转换成 line decisions；
- 让 `bridges.ts` 从单纯桥边规则扩展成“候选连接强制规则族”。

这能吸收 `CellConnected()` 的核心收益，同时保持 PuzzleKit 的解释粒度。

### 第三步：补齐 SingleLoopInCell 中可命名的通用单环规则

推荐拆成几条稳定规则：

- **Masyu Required Cell Degree**：必须经过的珍珠格只剩两条候选边时画线。
- **Masyu Same Component Closure**：候选边会把已知路径分量提前自连时打叉。
- **Masyu Required Source Connector**：某格或某边是连接 required sources 的唯一通路时强制。
- **Masyu Candidate Path Bounce**：作者 `lineaux` 对应的局部候选路径组推理；只有在解释足够清楚时再做。

其中前两条最稳，第三条最有性能价值，第四条需要谨慎，因为它最容易变成难解释的隐式 lookahead。

### 第四步：补高收益 Masyu pattern

pattern 的原则是：先选“短、确定、容易测试”的，而不是把作者所有坐标条件照搬。

优先顺序建议：

1. 白珠轴可行性：某轴两侧都无法转弯，强制另一轴。
2. linegraph + 白珠：白珠两侧同属一个路径分量时，排除该轴，强制垂直轴。
3. linegraph + 黑珠：黑珠某方向会连接回同一路径分量时，强制反向出口。
4. 双黑夹迫扩展：把作者更宽的不可行条件纳入现有规则。
5. 黑白长走廊 pattern：只挑能用一句话解释的情况。

这些规则可以先落在 `patterns.ts` 或拆出新的 graph-pattern 文件；如果实现时发现共用大量 linegraph 查询，再回收进 helper。

### 第五步：把作者 in/out 思想转写到 tile parity

不要引入 puzz.link 的 `CRQSUB` 语义。PuzzleKit 应继续使用：

- `PuzzleIR.tiles` 表示顶点中心区域颜色；
- `line` 表示相邻 tiles 异色；
- `blank` 表示相邻 tiles 同色；
- 边界 tiles 作为 outside/yellow anchor。

可新增的方向：

- 黑珠局部 tile color implication；
- 黑白组合触发的 tile color relation；
- 已知路径方向触发的 tile parity relation；
- tile color contradiction 作为 strong inference 的可解释失败原因。

每个颜色结论仍输出 `TileDiff`，每个线结论仍输出 `LineDiff`。

### 第六步：最后再整合强推断

作者脚本没有黑/白强推断，也没有当前这种结构化 lookahead。因此强推断不是移植重点。

推荐保持当前方向：

- deterministic rules 先吃掉作者的便宜结论；
- 黑/白 strong inference 继续作为后置 fallback；
- 后续如果要增强 strong inference，应基于 typed candidate source，例如黑珠出口、白珠轴、相邻白珠穿法、tile color component；
- 不把任意未知线作为默认猜测对象，避免求解过程退化成黑箱搜索。

## 测试建议

文档阶段不需要运行测试。后续实现时建议按规则族建立 fixture：

- `pnpm test:run src/domain/rules/masyu/rules.test.ts`
- graph bridge/articulation：桥边、割点、多个 required sources、无 required source 时不触发；
- 白珠组合：轴不可行、相邻白珠、linegraph 同分量排除；
- 黑珠组合：出口第二段不可行、双黑夹迫扩展、linegraph 同分量触发；
- tile color：白珠对角、黑白组合、同色叉/异色线、边界 outside anchor。

每条新增规则至少需要三个场景：

- 一个最小触发局面；
- 一个已有线/叉冲突或候选不足时不触发的局面；
- 一个验证 affected cells/lines/tiles 与 message 合理的回放断言。

## 推荐优先级

短期优先做 graph 层和 linegraph + 珍珠混合规则，因为这最可能解释作者在大题上的性能优势：

1. 扩展 line graph bridge/articulation helper。
2. 补 `connectivity and white` / `connectivity and black` 的可解释版本。
3. 补白珠轴可行性规则。
4. 扩展双黑夹迫和黑珠出口排除。
5. 再补 tile color 的黑白组合 implication。

长期来看，PuzzleKit 不应该追求复刻作者脚本的所有 `if`。更好的路线是：用作者脚本作为 pattern 和 topology 灵感来源，把其中高收益结论转成小而清楚的规则，让求解性能和解释性一起增长。
