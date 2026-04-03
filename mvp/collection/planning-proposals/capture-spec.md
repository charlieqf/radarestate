# Planning Proposals Online 采集说明

## 数据源

- 名称: `Planning Proposals Online`
- 入口: `https://www.planningportal.nsw.gov.au/ppr`

## 采集目标

首批只做“能稳定跟踪 proposal 管线变化”的最小集合，不先做复杂文档解析。

## 原始采集对象

### 1. 列表页快照

需要覆盖的 stage：

- `Under Assessment`
- `Pre-Exhibition`
- `On Exhibition`
- `Post-Exhibition`
- `Finalisation`
- `Made`
- `Withdrawn`

### 2. 单 proposal 详情页或详情链接

### 3. proposal 附件或文档链接目录

## 首批必抓字段

- `source_name`
- `title`
- `stage_raw`
- `stage_normalised`
- `stage_rank`
- `lga_raw`
- `location_text_raw`
- `proposal_url`
- `document_urls`
- `observed_at`
- `source_snapshot_date`

## 可选字段

- `published_date`
- `updated_date`
- `proposal_reference`
- `summary_raw`

## 首批不做

- 全文解析 PDF
- 从附件里结构化抽出全部 lot / DP
- 自动生成 parcel 级 geometry

## 最小产出

### Raw

- 每个 stage 一份列表快照
- 每次抓取的 URL 和日期记录

### Interim

- `planning_proposals_stage_index`
- `planning_proposals_latest`

### Curated

- `policy_signals` 中 `signal_type = planning_proposal`

## 命名规范

原始文件建议：

- `ppr_under-assessment_YYYY-MM-DD.html`
- `ppr_on-exhibition_YYYY-MM-DD.html`
- `ppr_proposal_<slug>_YYYY-MM-DD.html`

## 更新频率

- 建议每周 `2-3` 次

## 质量检查

- 同一 stage 本周是否有条目数量异常变化
- 是否存在 title 重复但 URL 不同的情况
- 是否存在 stage 变化但未记录到变化表

## 当前验证结论

- `Under Assessment`、`Under Exhibition`、`Finalisation` 页面都能直接看到 proposal ID、title、LGA/地址和详情链接
- 这说明首波完全可以先从 stage list 抓起，不必等复杂详情页解析
- 对 Sydney 来说，这个源已经足够支撑一版 `policy pipeline` 和 `changed precincts` 研究

## 完成标准

- 能输出本周新增 proposal
- 能输出本周 stage 变化 proposal
- 能按 `LGA` 汇总 proposal 活跃度
