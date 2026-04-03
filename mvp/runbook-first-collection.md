# 第一轮真实采集 Runbook

## 目标

在不追求完美自动化的前提下，完成三项真实数据的首轮落表：

- `Planning Proposals Online`
- `Application Tracker`
- `Housing Targets`

## 采集顺序

1. 先抓 `Housing Targets`
2. 再抓 `Planning Proposals Online`
3. 最后抓 `Application Tracker`

## 为什么先这样排

- `Housing Targets` 最稳定，适合先验证目录、表头、命名和记录流程
- `Planning Proposals` 是最重要的政策主线，第二个抓最合适
- `Application Tracker` 交互性更强，放第三步能减少前期混乱

## 第一步：Housing Targets

### 本轮目标

- 至少拿到总入口页
- 至少拿到 `5-10` 个重点 council 的 snapshot 页
- 把对应记录写入 `housing_target_context.csv`

### 本轮重点 council

- Parramatta
- Canterbury-Bankstown
- Inner West
- Liverpool
- Willoughby
- Ryde
- North Sydney

### 成功判断

- 至少能形成一版 `LGA pressure` 背景层

## 第二步：Planning Proposals Online

### 本轮目标

- 至少覆盖全部 stage 列表页一次
- 对进入 watchlist 的 proposal 额外保存详情页
- 写入 `planning_proposals_latest.csv`

### 本轮重点观察

- 重点 LGA 是否出现新 proposal
- 是否出现 stage 升级
- 是否存在 location_text 明显可落到重点 precinct 的条目

### 成功判断

- 至少能形成一版 `Top changed precincts` 或 `Top proposal-active LGAs`

## 第三步：Application Tracker

### 本轮目标

- 至少拿到 applications 和 state significant 两类结果页
- 至少抓到一批可识别 `council + status + address` 的记录
- 写入 `application_tracker_latest.csv`

### 本轮重点观察

- 重点 LGA activity 是否明显集中
- address 和 precinct 匹配难度如何
- status 标准化是否容易

### 成功判断

- 至少能形成一版 `activity by LGA` 视图

## 每一步都要做的事情

1. 保留 raw snapshot
2. 在对应 `update-log-template.csv` 记录更新
3. 把可结构化字段写入 interim CSV
4. 在 `source_observation_register.csv` 记录本轮结果

## 第一轮结束后要回答的问题

### 数据可得性

- 哪些源最稳定
- 哪些字段最容易拿到
- 哪些字段最容易丢失或格式不一致

### 分析可行性

- 现阶段最强结论来自哪个源
- 哪些可视化已经有足够数据支撑
- 哪些图还只是概念图，不该急着做

### 工程可行性

- 哪些源适合后续自动化
- 哪些源暂时适合人工半自动流程
- 哪些源值得继续扩大覆盖

## 第一轮之后最该做的输出

- 一页内部复盘
- 一版 `LGA Scoreboard` 草图
- 一版 `Policy Pipeline` 草图
- 一版 `Opportunity Map` 的数据需求清单
