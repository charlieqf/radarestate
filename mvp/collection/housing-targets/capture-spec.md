# Housing Targets 采集说明

## 数据源

- 名称: `Housing Targets`
- 入口: `https://www.planning.nsw.gov.au/policy-and-legislation/housing/housing-targets`

## 采集目标

首批把它作为 `policy pressure / supply context` 层，不把它当实时流水。

## 原始采集对象

### 1. housing targets 总入口页

### 2. council snapshot 页

### 3. 可能存在的 PDF / supporting links

## 首批必抓字段

- `source_name`
- `council_name_raw`
- `snapshot_url`
- `target_period_raw`
- `target_value_raw`
- `completion_or_progress_raw`
- `notes_raw`
- `observed_at`

## 可选字段

- `region_group`
- `housing_type_breakdown`
- `supporting_doc_url`

## 首批不做

- 一开始就把所有 snapshot 图表细节结构化
- 从静态截图里抽取每一个可视元素

## 最小产出

### Raw

- 总入口页快照
- 重点 council snapshot 页快照

### Interim

- `housing_targets_index`
- `housing_targets_context`

### Curated

- `policy_signals` 中 `signal_type = target_pressure`
- `watchlist_scoreboard` 的 pressure 部分

## 命名规范

原始文件建议：

- `housing-targets_index_YYYY-MM-DD.html`
- `housing-targets_<council-slug>_YYYY-MM-DD.html`

## 更新频率

- 建议每月检查一次
- 如政策更新集中，可临时加频

## 质量检查

- council 名称是否与统一 LGA 名称一致
- target period 是否一致
- snapshot 是否能稳定比较不同时间版本

## 完成标准

- 能形成 `LGA pressure` 基础指标
- 能与 proposal / activity 结果做基础对照
- 能支撑 `LGA Scoreboard` 中的压力维度
