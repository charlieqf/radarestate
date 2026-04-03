# 公开数据 MVP 方案

## 原则

- 只用公开可访问数据，不依赖付费数据源。
- 默认不使用需要审批或企业认证的 API。
- 先做 `可更新、可解释、可人工复核` 的系统，不追求一步到位全自动。
- 输出优先级高于数据完美度，先服务 `Top N 推荐 + 提醒 + 结论`。

## MVP 目标

在 `4-6` 周内做出一个可持续更新的 Greater Sydney 开发机会雷达，能稳定产出：

- 每周机会清单
- 高优先级变化提醒
- 重点 precinct 深度分析
- 地图和图表展示

## 推荐的第一阶段范围

### 地域范围

只做 Greater Sydney，不扩全州。

### 区域优先级

- Parramatta / Cumberland / Ryde
- Canterbury-Bankstown / Georges River
- Inner West / Burwood / Strathfield
- Liverpool / Campbelltown
- Willoughby / Ku-ring-gai / North Sydney

### 主题范围

只做以下主线：

- `Planning Proposals`
- `TOD`
- `Low and Mid-Rise Housing Policy`
- 周边 `DA / application activity`
- `Local Housing Strategies`
- 公开可得的主要 constraints
- 重点基础设施催化

## 数据源分层

### Tier 1：必须打通

| 数据源 | 用途 | 访问方式 | 更新节奏建议 | 风险 |
| --- | --- | --- | --- | --- |
| `planningportal.nsw.gov.au/ppr` | 追踪 Planning Proposal 阶段变化 | 公网页面 | 每周 2-3 次 | 字段可能不完全结构化 |
| `planningportal.nsw.gov.au/local-housing-strategies-tracker` | 判断 council 中长期 housing 战略方向 | 公网页面 | 每月 | 更新频率较低 |
| `planning.nsw.gov.au` 的 `Low and Mid-Rise Housing Policy` 页面和地图 | 判断受益站点、中心和适用范围 | 公网页面 + 官方地图 | 政策更新时复核 | 需要结合 exclusions 判断 |
| `planning.nsw.gov.au` 的 `TOD Program` 页面 | 判断 TOD 相关 precinct 和政策催化 | 公网页面 | 政策更新时复核 | 并非所有 TOD 信号都可直接转成可开发机会 |
| `Planning Portal` 的 `Application Tracker` 和 council tracker 列表 | 观察周边 DA 活跃度 | 公网页面 | 每周 | council 侧结构差异很大 |
| `OLG` / `LGNSW` council 目录 | 获取入口和官网映射 | 公网页面 | 季度 | 风险低 |

### Tier 2：强烈推荐，但不阻塞 MVP

| 数据源 | 用途 | 访问方式 | 更新节奏建议 |
| --- | --- | --- | --- |
| `Data NSW` 公开 GIS 图层 | flood、tree canopy、heat、部分约束层 | 下载或 ArcGIS 服务 | 月度 |
| `Transport for NSW` 项目页 / 项目地图 | 交通催化与项目进展 | 公网页面 | 月度 |
| `planning.nsw.gov.au` housing targets / council snapshots | 识别住房目标压力 | 公网页面/PDF | 季度 |
| `ABS` 公开统计表 | 人口、家庭结构、需求侧背景 | 下载表格 | 季度或年度 |

### Tier 3：后续增强

| 数据源 | 用途 | 原因 |
| --- | --- | --- |
| 环境宜居图层 | 更细粒度的风险/吸引力判断 | 对 MVP 不是刚需 |
| 更细的基础设施项目库 | 强化催化分析 | 需要更多清洗 |
| 市场成交或估值数据 | 做更强的 financial layer | 容易牵涉付费数据和再分发问题 |

### Tier 4：实验层（舆情 / 叙事）

| 数据源 | 用途 | 原因 |
| --- | --- | --- |
| Google Trends | 看 suburb / precinct 搜索热度趋势 | 公开、易解释，但只能代表相对关注度 |
| Whirlpool Real Estate 等公开论坛 | 观察本地讨论热度和主题变化 | 有价值，但噪音高且语义清洗成本大 |
| Reddit 公开社区与搜索结果 | 识别 narrative shift 和争议点 | 内容丰富，但访问稳定性和反爬限制更强 |
| Council `Have Your Say` 页面 | 观察本地政策争议和参与度 | 与规划直接相关，但结构化程度低 |

这层数据建议只作为 `attention / controversy / narrative shift` 的辅助信号，不建议在 MVP 阶段作为核心评分引擎。

## 建议的数据结构

不需要一开始做很复杂的数据库，先做稳定表结构。

### 1. `precincts`

- precinct_id
- name
- type（station / town centre / corridor / suburb）
- lga
- theme（TOD / LMR / mixed）
- geometry_ref

### 2. `policy_signals`

- signal_id
- source
- signal_type（proposal / LMR / TOD / LHS / target pressure）
- name
- stage
- stage_date
- lga
- location_text
- geometry_ref
- source_url
- summary

### 3. `application_signals`

- app_id
- source_council
- status
- application_type
- location_text
- lodgement_date
- proximity_precinct_id
- source_url

### 4. `constraints`

- constraint_id
- constraint_type（flood / heritage / bushfire / airport noise / pipeline 等）
- location_ref
- severity
- source_url

### 5. `opportunity_items`

- item_id
- name
- lga
- suburb_or_precinct
- trigger_summary
- policy_score
- capacity_score
- friction_score
- timing_score
- analyst_confidence
- recommendation
- status（watch / investigate / high priority / dropped）

### 6. `memos`

- memo_id
- item_id 或 precinct_id
- memo_type（weekly note / deep dive / alert）
- thesis
- what_changed
- why_now
- risks
- next_actions

## 机会评分框架

不要用一个黑箱总分作为唯一输出。

建议拆成 4 个分项：

### 1. Policy Catalyst

回答：政策变化是否明确，且是否正在推进。

参考信号：

- proposal 所处阶段
- 是否命中 TOD / LMR
- 是否与 housing targets 压力方向一致
- 是否存在正式公开文件而非仅口头预期

### 2. Development Capacity

回答：理论开发弹性是否提升。

参考信号：

- zoning 或 permissible use 变化
- height / FSR / density 条件变化
- precinct 范围内可形成中小型 assembly 的概率

### 3. Execution Friction

回答：地块或区域是否容易被约束卡住。

参考信号：

- heritage
- flood / bushfire
- aircraft noise / dangerous goods pipeline
- 需要复杂 assembly
- LMR/TOD 虽命中但 exclusions 明显

### 4. Market Timing

回答：这是不是一个“现在值得看”的机会。

参考信号：

- proposal 刚进入关键阶段
- 周边 DA 开始升温但市场传播还不广
- 基础设施催化已近，但大量供给尚未 fully priced in

最终只给三档：

- `A 级机会`
- `B 级观察`
- `C 级噪音`

舆情层如果加入，建议只作为解释性加分或提醒标签，而不是直接改变主评级。

## 更新流程

### 每周

- 更新 Planning Proposals
- 更新周边 DA 活跃度摘要
- 更新优先 precinct watchlist
- 跑一次变化检测
- 人工审核 Top 候选

### 每月

- 更新基础设施催化表
- 更新 LGA / precinct scoreboard
- 复核部分约束层和政策适用说明

### 每季度

- 复核 housing targets、人口和供给背景层
- 调整重点关注 precinct 清单

## 人工审核规则

必须人工复核的情况：

- 进入 Top 10 的新机会
- 政策命中但 constraints 很复杂
- 多个数据源互相矛盾
- 地址和 precinct 匹配不确定

人工审核输出只需要 3 件事：

- 是否保留
- 主要理由
- 下一步建议

## 最小技术栈

优先选不依赖外部平台审批的方案。

### 数据层

- 本地文件夹存 raw snapshots
- `CSV / GeoJSON / Parquet` 作为中间格式
- `DuckDB` 作为轻量分析层

### 处理层

- `Python + Pandas + GeoPandas`
- 小规模抓取和清洗脚本
- 简单的 HTML 表抓取 + 文件下载流程

### 展示层

- 周报：Markdown 转 PDF 或网页
- 轻量 dashboard：`Streamlit` 或 `Quarto`
- 地图：`MapLibre`、`Leaflet` 或静态导出地图

## 为什么先不用复杂后端

- 早期重点是定义“什么叫有价值的机会”，不是做重工程。
- 真正耗时的是规则和判断，不是搭数据库。
- 在客户尚未验证前，过早做复杂平台会分散精力。

## 4-6 周实施建议

### 第 1 周

- 固定 3-5 个重点 LGA / precinct
- 建立 source inventory
- 整理最小表结构

### 第 2 周

- 打通 Planning Proposals、LHS、TOD、LMR 基础数据
- 建立 watchlist 初版

### 第 3 周

- 接入周边 application / DA activity
- 加入基础 constraints
- 做初版评分逻辑

### 第 4 周

- 产出第一版 Weekly Radar 和 Hotlist
- 人工审核 20-50 条候选

### 第 5 周

- 做地图库和 scoreboard
- 完成第一版 alert 规则

### 第 6 周

- 完成 1-2 篇 Deep Dive Memo
- 用真实样本给潜在客户演示

## 交付定义

到了第 6 周，至少应该具备：

- 一个可更新的数据底表
- 一个 Top N 推荐清单
- 一个重点区域机会地图
- 一个每周周报模板
- 一个深度分析模板

## 最重要的取舍

MVP 的核心不是“覆盖最全”，而是：

- 哪些变化值得告诉客户
- 哪些地方值得继续看
- 哪些机会应该被优先行动

先把这三件事做准，后面再谈 API、自动化和更复杂的数据层。
