# Housing Target Context 字段

## 目的

补足 `Housing Targets` 在第一阶段的上下文字段定义。

## 表名

`housing_target_context`

## 首批字段

- `context_id`
- `lga`
- `region_group`
- `target_period`
- `target_value_raw`
- `completion_or_progress_raw`
- `source_url`
- `notes`
- `last_reviewed_at`

## 用途

- 供 `LGA Scoreboard` 使用
- 供 `target pressure` 信号生成使用
- 与 proposal / application 活动做对照

## 规则

- 早期允许保留 `raw` 字段，不强制全部数值化
- 在没有稳定数值口径之前，不做精确跨期比较
- 先把它当作政策压力背景层，而不是硬 KPI 数据源
