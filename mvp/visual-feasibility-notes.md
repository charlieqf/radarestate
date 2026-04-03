# 已验证数据下的可视化可行性

## 目的

这份说明只基于已经真实验证过的数据，不基于概念假设。

## 已验证的数据基础

### Housing Targets

目前已验证 10 个 Greater Sydney council snapshot 页面，字段稳定性很高。

已确认可稳定拿到：

- 5-year housing target
- resident population
- number of homes
- average household size
- heat vulnerability 文字摘要
- tree canopy 百分比和结构性描述
- 页面更新时间

### Planning Proposals Online

目前已验证多个 stage 页面，首屏列表可直接读到：

- proposal ID
- title
- stage
- LGA 或 location text
- detail link

已验证 stage：

- under assessment
- pre-exhibition
- under exhibition
- finalisation
- approved / made
- withdrawn / not proceeding

### Application Tracker

目前已确认：

- 普通 applications 通过公开 `POST` 接口返回结构化数据
- state significant applications 通过公开 JSON 端点返回结构化数据
- 已成功拉到 Sydney 小样本记录
- 已成功拉到重点 council 的 `TotalCount` 和 `recent_count` 样本
- 已把首批 focus councils 的 recent application records 批量写入 Supabase
- 当前数据库内 `application_signals` 已达 `26,015` 行，其中：
- `applications`: `25,071`
- `state_significant`: `944`

但目前仍未完成：

- 全量分页策略
- council / precinct 标准化匹配
- 面向产品的 activity 聚合逻辑

## 现在已经可以做的图

## 1. Housing Target Ranking

按 LGA 展示 `5-year target` 排名。

为什么现在就能做：

- 数值字段清晰
- 页面结构稳定
- 适合先做静态条形图

## 2. Target vs Existing Homes Scatter

横轴 `number of homes`，纵轴 `5-year target`。

为什么有价值：

- 能看出高目标是否叠加在已有住房存量较大的 LGA 上
- 对比 central / middle ring / growth corridor 很直观

## 3. Household Size vs Heat Vulnerability Narrative Chart

可先做半结构化图或带注释的二维图。

为什么有价值：

- 能把住房压力和热脆弱性放在一起讲
- 特别适合 Liverpool、Canterbury-Bankstown、Campbelltown 这类区域

## 4. Tree Canopy vs Target Pressure Chart

横轴 `tree canopy cover`，纵轴 `target` 或目标强度。

为什么有价值：

- 能形成很有传播性的“增长压力 vs 宜居性基础”图
- 适合北岸和西南增长区对比

## 5. Planning Proposal Stage Distribution

按 stage 统计 Sydney-relevant proposal 数量。

为什么现在就能做：

- stage 页面结构稳定
- ID、title、LGA、link 都能拿到

## 6. Sydney Proposal Watchlist Table

按 stage、LGA、title 列一个研究版 watchlist。

为什么现在就能做：

- 已经有足够的样本条目
- 不依赖 detail page 深解析

## 7. Positive / Negative Policy Signals Split

把 `pre/under/finalising/made` 与 `withdrawn/not proceeding` 放在同一张研究图上。

为什么有价值：

- 不只是看推进，也能看失败样本
- 适合做风险教育和信号质量筛选

## 暂时不该急着做的图

## 1. DA Activity Heatmap

原因：

- 虽然结果接口已确认可用，但当前只完成了小样本验证
- 在没有建立分页、过滤和 geography 映射前，直接做热图仍然会偏概念化

## 2. Council-Level Recent Activity Ranking

现在已经可以做。

为什么：

- `Application Tracker` 已确认支持 `CouncilDisplayName` 和 `LodgementDateFrom`
- 已经能得到每个 council 的 `TotalCount` 和 recent activity count
- 这足以先做 LGA / council 层的 activity ranking，而不必等待全量明细落表

当前已同步完成并可直接出 ranking 的重点 council 包括：

- Parramatta
- Cumberland
- Ryde
- Canterbury-Bankstown
- Georges River
- Canada Bay
- Inner West
- Burwood
- Strathfield
- Liverpool
- Campbelltown
- Willoughby
- Ku-ring-gai
- North Sydney

## 3. Precise Site-Level Opportunity Map

原因：

- 还缺稳定 geometry
- 还缺 address / precinct 一致匹配

## 4. End-to-End Pipeline Funnel

原因：

- proposal 和 application 还没真正打通
- 现在做会显得准确，但实际上链路不完整

## 最值得先做的第一组图

1. `Housing Target Ranking`
2. `Tree Canopy vs Target Pressure`
3. `Planning Proposal Stage Distribution`
4. `Sydney Proposal Watchlist`
5. `Council-Level Recent Activity Ranking`
6. `Target Pressure vs Recent Activity`

这 6 个图或表都已经有真实数据基础，不再只是概念。

## 现阶段最可信的结论类型

- 哪些 LGA 的住房目标压力更高
- 哪些 LGA 的树冠和热脆弱性背景更好或更差
- 哪些 Sydney precinct / council 目前在 proposal 管线里更活跃
- 哪些 proposal 已推进、哪些已终止

## 现阶段还不该过度承诺的结论类型

- 哪些地方 DA activity 已明显升温
- 单地块层面的确定性机会排序
- 从 policy 到 construction 的完整时间差模型

## 下一步建议

- 先基于已验证数据做第一版 `研究型图表`
- 同时把 `Application Tracker` 从小样本验证推进到可分页采集
- 等 activity 数据接通后，再升级成更强的 shortlist 和地图产品
