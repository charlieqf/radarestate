# B2B 服务设计

## 一句话定位

基于 NSW 公开规划数据的悉尼开发机会雷达，面向开发商和 buyer's agent 输出可执行的站点清单、变化提醒和深度分析结论。

## 核心判断

- 不先做“全功能地图平台”，先做 `情报工作流 + 半产品化交付`。
- 不卖原始公开数据，卖 `筛选、排序、解释、提醒`。
- 先聚焦 Greater Sydney，尤其是 `TOD + Low and Mid-Rise + Planning Proposals` 密集区域。
- 最强场景不是“帮散户找便宜房”，而是“帮 acquisition 角色减少刷数据、筛地、判断优先级的时间”。

## 最优客户顺序

| 优先级 | 客户类型 | 为什么优先 |
| --- | --- | --- |
| 1 | 小中型开发商 | 有明确 acquisition 需求，愿意为 shortlist 和前期判断付费 |
| 2 | Buyer’s agent（开发地块导向） | 经常需要快速筛站点、街区和候选地块 |
| 3 | 家族办公室 / 土地银行型投资人 | 对中长期政策催化更敏感，但决策更慢 |
| 4 | 中介 / 顾问 / 研究团队 | 更适合后期扩展，不是第一批核心客户 |

## 客户最真实的痛点

- 公开信息很多，但入口分散在 `Planning Portal`、各 council、Data NSW、TfNSW 页面。
- 真正值得看的变化很少，但筛选成本很高。
- 很多信号是“政策开始动了”，不是“现在就能成交”，需要人工解释。
- acquisition 团队缺的不是更多地图，而是更少、更准、更能行动的清单。

## 服务结构

### 1. Weekly Radar

每周一次，偏“全局扫描”。

包含内容：

- 本周 `Top 10` 新增机会
- 本周 `Top 10` 状态升级机会
- 本周最热 `LGA / station precinct / suburb` 排行
- 本周高优先级政策变化摘要
- 本周值得继续跟进的 `watchlist`

交付形式：

- PDF 周报
- 邮件摘要
- 内部网页或轻量 dashboard 链接

### 2. Hotlist

这是核心付费交付，偏“可执行 shortlist”。

每条机会至少包含：

- 地址或街区
- LGA
- 当前 zoning / 已知政策命中情况
- 触发原因
- 主要催化剂
- 主要约束
- 机会评级
- 推荐动作

适合做成 `Top 20` 或 `Top 50` 列表。

### 3. Priority Alerts

只推送少量高价值事件，避免客户信息疲劳。

建议触发条件：

- Planning Proposal 进入更高确定性的阶段
- 某 precinct 明确进入 `TOD` 或 `Low and Mid-Rise` 受益范围
- 某 LGA 在住房目标压力下出现新 planning movement
- 周边出现密集 DA / proposal 共振

交付形式：

- 邮件
- Slack / Teams 消息
- 简短网页提醒卡片

### 4. Deep Dive Memo

高价产品，用来提升客单价和粘性。

适合按以下主题出报告：

- 某条 metro / rail corridor
- 某个 station precinct
- 某个 LGA 或 suburb
- 某类开发产品，如 townhouse、mid-rise、shop-top housing

报告结构建议固定：

- Thesis
- What changed
- Why now
- What unlocks value
- Key constraints
- Best site archetypes
- Recommended next actions

## 与竞品的真正差异化

不要把自己定义成 `Archistar` 或 `Landchecker` 的廉价替代。

差异化应该是：

- 更聚焦 NSW / Sydney 规划变化
- 更强调 `政策变化 -> 可行动清单`
- 更强调 analyst judgement，而不是“你自己去地图里慢慢找”
- 更快把碎片化公开信号整理成 acquisition workflow

一句话说清：

`不是查地工具，而是政策驱动型选地雷达。`

## 产品边界

### 现在不做

- 不做全国覆盖
- 不做大众投资者教育产品
- 不先做复杂估值或“低估多少钱”的硬结论
- 不承诺完全自动化
- 不依赖需要认证审批的外部数据服务

### 现在先做

- Greater Sydney
- 少量高价值 LGA / precinct
- 周报、清单、提醒、深度分析
- analyst-in-the-loop 的半自动 workflow

## 推荐的服务包

### 入门版

适合小型 buyer’s agent 或单个 acquisition lead。

- 每周 Weekly Radar
- 每周 Top 10 Hotlist
- 基础 alert

### 标准版

适合有固定 acquisition 节奏的小中型开发商。

- 每周 Weekly Radar
- 每周 Top 20-30 Hotlist
- Priority Alerts
- 每月 1 篇 Deep Dive Memo

### 定制版

适合有明确 geographic focus 的团队。

- 指定 LGA / corridor / station watchlist
- 自定义筛选规则
- 每月多篇 Deep Dive
- 可加内部 briefing

## 定价假设

以下仅是早期验证假设，不是最终定价。

| 方案 | 月费假设 | 说明 |
| --- | --- | --- |
| 入门版 | A$1,500-A$3,000 | 核心卖点是节省筛选时间 |
| 标准版 | A$4,000-A$8,000 | 含深度分析，适合 retained relationship |
| 定制版 | A$8,000+ | 按重点区域、频率、分析深度调整 |

额外收入可来自：

- 按份收费的 site memo
- 专题 corridor 报告
- 内部 workshop

## 运营工作流

### 每周节奏

1. 抓取和更新公开数据
2. 统一 proposal / policy / precinct / constraint 信息
3. 跑初步评分和变化检测
4. 人工审核 Top 候选
5. 生成周报、hotlist、alerts
6. 记录客户反馈和命中情况

### analyst 必须保留的人工判断

- 这次变化是不是噪音
- 这个站点是不是“值得行动”而不只是“值得关注”
- 主要障碍是约束、执行还是 timing
- 推荐动作是继续监控、接触业主、做更深尽调，还是直接剔除

## 成功指标

早期不要迷信流量指标，先盯交付质量和客户行动。

- 每周 shortlist 被客户真正点开的比例
- 客户标记“值得继续追”的条目比例
- 从 radar 到实际 follow-up call 的数量
- 进入客户 watchlist 的 site 数量
- 客户续费率
- 客户主动要求深挖的 precinct 数量

## 前 90 天验证路径

### 第 1 阶段：做出样本

- 选 `3-5` 个重点 LGA 或 `10-20` 个重点站点
- 连续跑 `4-6` 周周报
- 累积至少 `50-100` 条候选机会样本

### 第 2 阶段：拿客户访谈

- 约 `10-15` 个潜在客户演示样本
- 观察他们最先看哪类信息
- 记录他们是否愿意为清单、提醒、深度分析付费

### 第 3 阶段：从“报告”升级成“工作台”

- 保留 PDF / 邮件交付
- 同时做一个轻量内部 dashboard
- 把人工最常看的字段前置到系统首页

## 最推荐的切口

`Greater Sydney station precinct opportunity radar for small-mid developers and buyer’s agents`

如果要再说得更锐利一点：

`基于公开规划数据，提前发现站点与中心周边正在被政策重定价的候选开发机会。`
