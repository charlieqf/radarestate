# 首批字段清单

## 目标

这份清单定义第一阶段最值得维护的字段，优先满足：

- Weekly Radar
- Top N Hotlist
- Priority Alerts
- Deep Dive Memo

## 第一阶段最小主题表

### 1. `precincts`

用来统一站点、中心、走廊和 suburb 级别的关注对象。

必备字段：

- `precinct_id`
- `name`
- `type`
- `lga`
- `policy_theme`
- `source_url`
- `watch_priority`

### 2. `policy_signals`

用来记录 proposal、TOD、LMR、LHS、housing target pressure 等政策信号。

必备字段：

- `signal_id`
- `signal_type`
- `title`
- `stage`
- `stage_rank`
- `lga`
- `precinct_id`
- `location_text`
- `published_date`
- `updated_date`
- `source_url`
- `summary`

### 3. `application_signals`

用来记录周边 DA / application 活跃度。

必备字段：

- `app_id`
- `source_name`
- `council`
- `application_type`
- `status`
- `location_text`
- `lodgement_date`
- `source_url`
- `precinct_id`

### 4. `constraints`

用来记录会影响开发可行性的主要约束。

必备字段：

- `constraint_id`
- `constraint_type`
- `severity`
- `location_text`
- `precinct_id`
- `source_url`

### 5. `opportunity_items`

这是最重要的输出表，直接服务 Top N 和周报。

必备字段：

- `item_id`
- `item_name`
- `lga`
- `precinct_id`
- `trigger_summary`
- `policy_score`
- `capacity_score`
- `friction_score`
- `timing_score`
- `opportunity_rating`
- `analyst_confidence`
- `recommended_action`
- `status`
- `source_bundle`

## 字段设计规则

- 每张表都尽量保留 `source_url`
- 所有重要时间字段都单独存 date，不塞进文本摘要里
- `stage` 和 `status` 必须标准化，不直接沿用各页面的原始写法
- 输出表必须能直接解释“为什么这条进入 shortlist”

## 评分字段建议

### `policy_score`

表达政策催化强度。

### `capacity_score`

表达理论开发弹性。

### `friction_score`

表达实施阻力，分高低前要先定义统一方向。建议 `分数越高 = 阻力越大`。

### `timing_score`

表达现在是否值得看。

## 输出字段建议

### `opportunity_rating`

只用：

- `A`
- `B`
- `C`

### `recommended_action`

只用：

- `Watch`
- `Investigate`
- `Prioritise`
- `Drop`

### `status`

只用：

- `active`
- `on_hold`
- `promoted`
- `dropped`

## 参考

更细的字段说明见 `field-dictionary.csv`。
