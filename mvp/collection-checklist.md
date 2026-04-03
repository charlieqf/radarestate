# 首波采集执行清单

## 目标

用最少的数据源，先验证 3 件事：

1. 能不能稳定拿到公开数据
2. 能不能把这些数据统一到同一套地理和分析框架
3. 能不能据此产出真正有用的结论和图表

## 第一阶段的成功标准

完成以下 6 项，就说明首波采集有价值：

- 能稳定拿到 `Planning Proposals` 最新状态
- 能拿到至少一层可用的 `Application / DA activity`
- 能建立 `LGA + precinct + station` 的统一骨架
- 能把至少 3 类 constraints 叠加进来
- 能形成第一版 `LGA / precinct` 排名
- 能做出 3 张以上真正解释力强的图表或地图

## 阶段 1：地理骨架

### 目标

先统一“在哪里”，再谈“发生了什么”。

### 必做数据

- LGA 边界
- SA2 或等价统计区边界
- 重点 station / centre / precinct 列表
- 重点 watchlist precinct 对应关系

### 产出

- `precincts` 基础表
- 统一 geography 命名规则
- 重点 precinct watchlist

### 完成判断

- 任意一个 proposal 或 application 至少能落到 `LGA` 和 `precinct`

## 阶段 2：核心流水

### 目标

先把“政策变化”和“开发活动”两条主线抓到手。

### 必做数据

- `Planning Proposals Online`
- `Application Tracker`
- `Major Projects`
- `Council Trackers Directory`

### 首批字段目标

- 标题
- 地点文本
- LGA
- 状态 / 阶段
- 日期
- 来源链接

### 产出

- `policy_signals` 初版
- `application_signals` 初版
- 第一版变化检测表

### 完成判断

- 本周新增和状态变化可以被识别
- 至少能列出一个 `Top changed precincts` 排名

## 阶段 3：政策与供给层

### 目标

让流水数据具备上下文。

### 必做数据

- `Housing Targets`
- `Urban Development Program`
- `Local Housing Strategies Tracker`

### 产出

- `housing_target_context` 表
- `supply_context` 表
- 第一版 `target gap` 或 `pipeline pressure` 指标

### 完成判断

- 能回答“哪些 LGA 有政策压力但活动不足”
- 能回答“哪些地方 proposal 多，但 supply pipeline 已经很拥挤”

## 阶段 4：约束层

### 目标

避免把“看上去有机会”的地方误判成高优先级。

### 必做数据

- `Biodiversity Values Map`
- `Bush Fire Prone Land`
- `Flood Data Portal`

### 产出

- `constraints` 表
- `friction summary` 表
- 第一版 `high-opportunity but high-friction` 标记

### 完成判断

- 能排除明显高风险 precinct
- 能解释为什么有些政策命中区域仍不该进入 A 级机会

## 阶段 5：需求背景层

### 目标

避免产品只剩供给和政策逻辑。

### 必做数据

- `ABS Regional Population`
- `ABS Data by Region`
- `NSW Population Projections`

### 产出

- `demand_context` 表
- 人口增长和收入背景图层
- 第一版 `growth vs pipeline` 对照图

### 完成判断

- 能做出“增长强但 pipeline 弱”与“增长弱但供应强”的对照

## 阶段 6：研究与可视化验证

### 目标

不要先假设图表长什么样，而是拿数据倒推。

### 第一轮必须验证的图表

- `LGA Scoreboard`
- `Policy Pipeline by Stage`
- `Opportunity Map`
- `Growth vs Pipeline Scatter`
- `Constraint Overlay Map`

### 第一轮必须验证的结论

- 哪些 precinct 的政策和活动在同步升温
- 哪些 LGA 的压力最大但活动不足
- 哪些区域看似很热，实际 constraints 很重
- 哪些区域只是媒体热，不是规划热

## 每个数据源都要打的标签

- `是否公开可稳定访问`
- `是否结构化`
- `是否适合自动采集`
- `是否值得高频更新`
- `是否对 shortlist 有直接贡献`
- `是否更适合人工核验`

## 每周工作节奏

### 周一

- 更新 policy 和 application 主流水

### 周二

- 跑变化检测和初步 ranking

### 周三

- 复核 constraints 和重点 precinct

### 周四

- 写结论、挑图、形成 Top N

### 周五

- 输出周报和内部复盘

## Go / No-Go 标准

### Go

- 数据能连续 3 周稳定更新
- 至少 30-50 条机会记录能形成可解释 shortlist
- 至少 3 种图表能稳定复用

### No-Go 或暂缓

- 数据需要过多人工清理才能复用
- 一个源对结论几乎没有贡献
- 图表看起来很好，但无法指导任何动作

## 第一波之后再决定的事情

- 是否扩 council tracker 覆盖
- 是否下沉到 site-level
- 是否把舆情层并入周报
- 是否开始接估值或交易类外部数据
