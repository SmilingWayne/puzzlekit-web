# Puzzlink Assistance 的 Masyu 求解流程分析

这份文档记录对 `Puzzlink_Assistance.js` 中 Masyu 部分的阅读结论。它不是移植说明，而是帮助我们理解作者脚本为什么在一些大题上表现不错，以及哪些思想值得拆解后吸收到 PuzzleKit 的可解释规则框架里。

## 总体流程

作者脚本是一个直接嵌入 puzz.link 页面的油猴脚本。它并不维护一套独立的 puzzle IR，而是直接读取和修改 puzz.link 的 `ui.puzzle.board`：

- `assist()` 初始化本轮求解状态，设置 `board = ui.puzzle.board`，然后循环调用具体题型的 assist 函数。
- 对 Masyu 来说，实际入口是 `MasyuAssist()`。
- 每轮推导结束后，如果还有新增结论，脚本会用 `setTimeout(..., 0)` 继续下一轮，直到没有变化、超过 `MAXLOOP`、超时，或者 `Assist Step` 模式已经产生一步有效修改。
- `stepcheck()` 是全局推进器：每当 `add_line`、`add_cross`、`add_inout` 等函数真的写入了状态，就增加计数；如果当前是 step 模式，会通过抛出 `"Step finished."` 立刻中止。

所以作者的求解不是“一个规则返回一个解释步骤”，而是“一个大循环不断把所有可用结论直接写回棋盘”。这对性能和覆盖面很有利，因为各种结论会在同一轮或下一轮马上互相喂给对方；代价是很难拆出清晰、稳定、可回放的推理说明。

## MasyuAssist 的结构

`MasyuAssist()` 很短，但它调用的通用函数很重：

```js
function MasyuAssist() {
    SingleLoopInCell({
        isPass: c => c.qnum !== CQNUM.none,
    });
    ...
}
```

这句的含义是：把所有珍珠格都视为“必须被环经过”的格子，然后先运行一套通用单环推理。之后，作者再在 `forEachCell(cell => { for (let d = 0; d < 4; d++) { ... } })` 中枚举每个格子和四个旋转方向，执行 Masyu 专用 pattern。

可以把作者的 Masyu 求解分成两层：

1. **通用单环层**：`SingleLoopInCell()` 负责所有单环谜题都可能用到的度数、死路、连通性、内外侧颜色传播。
2. **Masyu 专用层**：`MasyuAssist()` 里硬编码白珠、黑珠、黑白组合、长走廊连接等局部 pattern。

这也是作者脚本强的地方：它不是只有 Masyu 局部规则，而是把 Masyu 珍珠规则放进了一个比较完整的 loop/topology 框架里反复迭代。

## 通用单环层：SingleLoopInCell

`SingleLoopInCell()` 是作者 Masyu 性能的核心之一。它的输入是一组谓词和写入函数，Masyu 只特别指定了 `isPass: c => c.qnum !== CQNUM.none`，也就是珍珠必须经过。

它主要做这些事。

### 1. 单环基础约束

它扫描每个 cell 的四条边，维护：

- `linecnt`：当前已知线数量；
- `emptycnt`：仍可走的候选边数量；
- `isPass(cell)`：这个格子是否必须被环经过；
- `isPathable(border)`：这条边是否还可能成为线。

典型结论包括：

- 不可经过的格子周围全部打叉；
- 如果一个必须经过的格子只剩两条可行边，就把两条都画线；
- 如果一个格子已经有两条线，就把其他方向打叉；
- 如果某格没有足够出口，就打叉并标记为不可经过。

这些是单环谜题的“度数”和“死路”基础推理。

### 2. 防止 premature loop

作者使用 puzz.link 的 `board.linegraph.components` 和每个 cell 的 `path` 信息判断已知线段是否属于同一个连通分量。

当某条候选边会把同一条路径提前闭成小环，而棋盘上还有其他必须经过或已经画出的部分没有连接进来时，脚本会把这条边打叉。这里对应 PuzzleKit 里的 `Prevent Premature Loop`，但作者还把它和更多局部路径形态混在一起使用。

### 3. 已知路径分量的连通性推理

`SingleLoopInCell()` 不只禁止小环，还会利用“多个路径分量最终必须成为一个环”的事实做强制：

- 某个未经过的格子如果四周候选邻居都属于同一路径分量，进入它可能导致局部自连，于是相关边被排除。
- 某个必须经过的格子如果只有一种方式可以连接两个不同候选路径组，就强制对应边。
- `lineaux` 被用作临时“可能线”标记，帮助判断候选路径组的连通关系；它不是正式答案线，但能参与局部连接分析。

这部分是 PuzzleKit 当前最值得吸收的内容之一。作者并没有把它写成独立的“桥边规则”或“割点规则”，而是嵌在单环通用函数里，导致很多 topology 结论自然出现。

### 4. 顶点 in/out 颜色传播

在没有 ice/cross 这类特殊机制时，作者会给 grid cross 使用 `CRQSUB.in` / `CRQSUB.out` 的隐式标记：

- 已知线两侧的顶点颜色不同；
- 已知叉或非线通道两侧颜色相同；
- 如果两个相邻顶点颜色相同，就打叉；
- 如果颜色不同，就画线；
- 白珠会强制对角顶点颜色相反；
- 某些黑白组合也会传播顶点颜色关系。

这和 PuzzleKit 当前的 `PuzzleIR.tiles` 很接近：我们把顶点中心的区域颜色存成 tile fill，线和叉对应 tile parity 的异同关系。区别是作者把颜色传播和线判断放在同一个大函数里持续迭代，而 PuzzleKit 为了可解释性拆成了 `Tile Color Propagation`、`Color-Pearl Propagation`、`Color-Line Propagation` 和 `Tile Connectivity Cut Coloring`。

## 通用连通框架：CellConnected

`CellConnected()` 是作者脚本里另一个重要基础设施。它不是 Masyu 专用，而是一个可配置的 Tarjan 连通性工具。

它接收：

- 什么算 shaded / unshaded；
- 发现必须 shaded 时怎么写入；
- 发现必须 unshaded 时怎么写入；
- 哪些边可通行、哪些边已连接；
- 是否把棋盘外侧当成 shaded；
- 是否要找 bridge，并把 bridge 转成线或 link。

内部做法是：

- 用 DFS/Tarjan 维护 `ord` 和 `low`；
- 统计每个 DFS 子树里有多少目标对象；
- 如果某个点一旦移除会把必须连通的对象分开，就把它加入 `shadelist`；
- 如果某条边是连接必须连通对象的唯一桥，就把它加入 `bridgelist`；
- 最后统一调用 `add_shaded`、`add_unshaded` 或 `add_line` / `add_link`。

在 `SingleLoopInCell()` 中，它主要被用于 cross 顶点的 in/out 连通与传播；在其他谜题中也可用于黑格、白格、区域连通等推理。对 PuzzleKit 来说，它的价值不在于代码形式，而在于“同一个 low-link 框架可以同时服务割点、桥边、不可达区域、强制连接”这个抽象。

## Masyu 专用推理策略

作者在 `MasyuAssist()` 中写了一组旋转对称的局部判断。下面按推理家族归类，而不是逐条 `if` 机械编号。

### 1. 白珠直行与相邻转弯

白珠必须直行穿过，但至少一侧相邻格必须转弯。作者覆盖了几类常见情况：

- 如果白珠某一侧已经有线，或垂直方向已不可走，就强制白珠沿该轴直行，并把垂直方向打叉。
- 如果白珠一侧已经连续直行两段，那么另一侧不能也继续直行，于是远端候选边被打叉。
- 如果白珠左右两侧都因为线、相邻白珠、黑珠、或不可行边而无法满足横向穿过后的转弯条件，就打叉横向、强制纵向。

其中第三类是比较有价值的 pattern：它不是简单的“白珠已有一条线”，而是在判断某个轴是否还能满足相邻转弯条件。PuzzleKit 现在已有白珠候选 pruning，思想上接近，但作者在局部 pattern 中覆盖了一些更具体的触发形态。

### 2. 黑珠转弯与两步直行延伸

黑珠必须转弯，并且从黑珠出去后的下一格必须继续直行一段。作者写了：

- 如果黑珠某方向已经有线，则继续强制同方向第二段；
- 如果某个出口不可能合法使用，就打叉该出口，并常常强制对侧出口；
- 如果黑珠面对黑珠、白珠组合、边界或不可行边，会排除某些出口。

PuzzleKit 当前的黑珠规则和黑珠候选 pruning 已覆盖主干逻辑，但作者有一些局部 pattern 可以更早产生结论，尤其是“出口被未来第二段或邻近珍珠形态排除”的情况。

### 3. 双黑夹迫

作者有一个典型 pattern：

```text
++
● · ●
++
```

如果两个黑珠夹着一个中间格，而中间格某个垂直方向已经不能走，那么另一个垂直方向也被打叉。直觉是：中间格不能只给一个黑珠提供不对称的转弯路径，否则会破坏黑珠的转弯/延伸要求。

PuzzleKit 已有 `Double Black Squeeze`，但当前实现偏窄：只在中间格某一条垂直候选已 blank 时推出另一条 blank。作者的条件族更宽，会结合 `isPathable` 和周边局部形态判断。

### 4. 连续与相邻白珠 pattern

作者覆盖了连续白珠带来的方向排除和强制：

- 连续白珠会限制它们只能以某种轴穿过；
- 相邻白珠如果某些侧向转弯不可行，会强制另一种穿法；
- 白珠组合还会参与 in/out 顶点颜色传播。

PuzzleKit 当前有 `Consecutive White Pearls Straight` 和 `Adjacent White Pearls LookAhead`。后者比作者脚本更结构化，但作者脚本中仍有一些“不是完整 lookahead、但很便宜”的白珠组合 pattern 值得拆出来。

### 5. 黑白组合 pattern

作者有几类黑珠与白珠组合：

- 黑珠面对两个连续白珠时，黑珠远离白珠的一侧被强制画线。
- 黑珠斜向两侧有白珠时，会强制黑珠向另一侧延伸。
- 某些黑白组合会让顶点 in/out 颜色相同或相反，从而继续推出线/叉。

PuzzleKit 里已经有 `Black Facing Consecutive Whites` 和 `Black Diagonal White Pinch`，但作者还写了更长距离、更依赖已有 linegraph 的黑白组合。

### 6. 基于 linegraph 的长走廊连通 pattern

`MasyuAssist()` 末尾有几条明显依赖 `board.linegraph.components.length > 1` 的规则。它们的共同前提是：当前已有线形成了一个长走廊或局部路径，如果不在某处继续连接，就会过早闭合或无法把其他珍珠接入同一环。

这些规则看起来像硬编码 pattern，但本质更接近 graph 连通性推理。它们在大题上可能很有效，因为大题中长路径分量多，局部形状很容易触发“唯一连接方式”。

### 7. 连通性与珍珠局部规则的混合

作者还专门写了：

- connectivity and black：如果黑珠与某个远端格已经在同一路径分量中，而中间还没有连接，则强制黑珠向反方向出线。
- connectivity and white：如果白珠两侧相邻格已经在同一路径分量中，为避免白珠沿该轴造成自连，强制它改走垂直方向。

这两条很值得注意。它们不是普通 pearl-local 规则，而是把“珍珠形状约束”和“已知路径分量不能提前自连”结合起来。PuzzleKit 当前有 premature loop 和候选 pruning，但这类“linegraph 状态触发的珍珠 pattern”还可以更明确地补。

## 作者实现了几种策略？

如果按可移植的推理家族看，作者至少实现了以下 8 类：

1. **单环度数与死路规则**：二度补全、三度/溢出排除、必须经过格只剩两出口则画线。
2. **premature loop 防止**：同一路径分量提前闭环时打叉。
3. **路径分量连通性规则**：利用 linegraph、候选边和 lineaux 判断必须连接或禁止自连。
4. **Tarjan 割点/桥边规则**：`CellConnected()` 对必须连通对象做 cut vertex / bridge 推理。
5. **顶点 in/out 颜色传播**：同色打叉、异色画线，并从线/叉继续传播颜色。
6. **Masyu 珍珠基础规则**：白珠直行转弯、黑珠转弯延伸。
7. **Masyu 局部 pattern**：双黑、连续白、黑白组合、长走廊组合。
8. **珍珠约束与连通性的混合规则**：根据当前路径分量状态触发黑珠/白珠方向选择。

作者没有实现 PuzzleKit 当前已有的黑珠强推断、白珠强推断，也没有把相邻白珠做成结构化 lookahead。作者的优势更多来自“便宜、全局、持续迭代”的 deterministic/topology 组合，而不是深搜索。

## 对 PuzzleKit 的启发

直接移植 `MasyuAssist()` 不合适，因为它的结论是批量、隐式、直接写回 board 的；但它给出了三个很清楚的方向：

- **graph 层优先**：先把 `SingleLoopInCell()` 中那些非坐标 pattern 的 loop graph 逻辑抽象出来。
- **颜色推理更贴近线判断**：现有 tile parity 很适合承接作者的 in/out 思想，但需要更多 pearl-local 和 connectivity 触发点。
- **pattern 只挑高收益的**：作者脚本里有不少坐标硬编码，值得移植的是解释短、测试小、能明显补强大题性能的那部分。
