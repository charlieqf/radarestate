# 从当前样本迁移到 Supabase

## 目标

把当前本地样本文件迁到 Supabase，同时保留 raw files 作为审计和回放依据。

## 迁移原则

- `raw html/json/pdf` 不直接入表
- `CSV` 只作为一次性导入源或中间导出物
- 入库时尽量同时保留：
  - 规范化字段
  - `raw_payload`
  - `source_url`
  - `observed_at`

## 推荐顺序

1. 建表
2. 先导入 councils
3. 再导入 housing_targets
4. 再导入 planning_proposals
5. 再导入 planning_proposal_stage_history
6. 再导入 application_signals
7. 再导入 council_activity_counts
8. 最后刷新 views

## 第 1 步：执行 schema

在 Supabase SQL Editor 执行：

- `supabase/schema.sql`
- `supabase/views.sql`

## 第 2 步：准备 councils

先人工插入或批量导入一份最小 council 清单。

当前样本至少要包含这些 council：

- Parramatta
- Canterbury-Bankstown
- Inner West
- Liverpool
- Ryde
- North Sydney
- Willoughby
- Ku-ring-gai
- Campbelltown
- Strathfield
- Canada Bay
- Sutherland Shire
- Hunters Hill
- Woollahra
- Fairfield
- The Hills Shire
- Penrith
- Georges River
- Bayside
- Blacktown
- Cumberland

建议字段：

- `canonical_name`
- `display_name`
- `region_group = Greater Sydney`
- `is_focus = true`

## 第 3 步：导入 housing_targets

来源文件：

- `mvp/data/interim/housing_target_context.csv`

导入策略：

- `target_value_raw` 原样保留
- 同时解析出 `target_value`
- 从 `notes` 中逐步拆出：
  - `resident_population`
  - `number_of_homes`
  - `average_household_size`
  - `urban_tree_canopy_pct`
  - `high_heat_vulnerability_pct`
- `source_updated_date` 从 notes 里的 `updated 2025-08-04` 提取

建议：

- 首次导入可以半手工
- 先追求正确，不先追求全自动解析 notes

## 第 4 步：导入 planning_proposals

来源文件：

- `mvp/data/interim/planning_proposals_latest.csv`

导入策略：

- `proposal_key = signal_id`
- `proposal_number` 可从 title 或后续 detail page 中补充
- `stage`、`stage_rank` 原样导入
- `last_seen_at = updated_date`
- `first_seen_at` 初次可等于 `updated_date`

如果后续有重复抓取：

- 对同一 `proposal_key` 做 `upsert`
- 如果 stage 变化，额外插入 `planning_proposal_stage_history`

## 第 5 步：导入 application_signals

来源文件：

- `mvp/data/interim/application_tracker_latest.csv`

导入策略：

- `app_key = app_id`
- `portal_app_number = app_id`
- `tracker_scope` 原样导入
- council 名称先映射到 `councils.id`
- geometry 后续再补，当前可先空着 `latitude/longitude`

后续直接接 API 时：

- 普通 DA 接口可直接落 `latitude/longitude`
- state significant 端点的 `coordinates` 需要拆分

## 第 6 步：导入 council_activity_counts

来源文件：

- `mvp/data/interim/application_activity_counts.csv`

导入策略：

- `recent_window_start = 2025-01-01`
- `observed_at = last_reviewed_at`
- `status_scope = ALL`

这张表对第一版图表很重要，因为它能先提供 council-level activity 排名。

## 第 7 步：导入 ingest_runs 和 source_snapshots

这个不是首批必须，但建议尽快补上。

最小做法：

- 每次正式抓取新建一条 `ingest_runs`
- raw 文件路径写入 `source_snapshots.storage_path`
- notes 写抓取范围和异常

## 第 8 步：验证 views

导完后检查：

- `select * from public.v_council_scoreboard order by target_value desc nulls last;`
- `select * from public.v_policy_pipeline;`
- `select * from public.v_target_pressure_vs_activity order by recent_activity_to_target_ratio desc nulls last;`
- `select * from public.v_recent_application_ranking;`

## 当前不建议马上做的事情

- 不要先把所有 raw 内容直接塞数据库
- 不要先做复杂 RLS 或多租户权限
- 不要先做完整 API 层
- 不要先做 geometry 全覆盖

## 最小上线状态

当以下 4 项完成时，Supabase 层就已经有价值：

- `housing_targets` 能正常查询
- `planning_proposals` 能正常查询和按 stage 统计
- `application_signals` 能存第一批结构化 activity
- `v_council_scoreboard` 和 `v_target_pressure_vs_activity` 能直接出图
