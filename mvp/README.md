# MVP 工作目录

## 目标

这个目录用于承载首版 `Sydney Planning Opportunity Radar` 的数据、配置、模式定义和输出样稿。

设计目标：

- 可持续更新
- 以公开数据为主
- 方便人工审核
- 先服务周报、清单、提醒和深度分析

## 目录结构

```text
mvp/
  README.md
  collection-checklist.md
  source-capture-plan.md
  sentiment-layer-framework.md
  runbook-first-collection.md
  visual-feasibility-notes.md
  collection/
    README.md
    planning-proposals/
      capture-spec.md
      update-log-template.csv
    application-tracker/
      capture-spec.md
      update-log-template.csv
    housing-targets/
      capture-spec.md
      update-log-template.csv
  config/
    priority-watchlist.md
  data/
    raw/
      README.md
      planning-proposals/
        README.md
      application-tracker/
        README.md
      housing-targets/
        README.md
    interim/
      README.md
      planning_proposals_latest.csv
      application_tracker_latest.csv
      application_activity_counts.csv
      housing_target_context.csv
      source_observation_register.csv
    curated/
      README.md
      policy_signals.csv
      application_signals.csv
      watchlist_scoreboard.csv
  reports/
    weekly-radar-sample.md
    first-sample-research-note.md
  schemas/
    first-batch-fields.md
    field-dictionary.csv
    planning-proposals-field-mapping.csv
    application-tracker-field-mapping.csv
    housing-targets-field-mapping.csv
    housing-target-context-fields.md
```

## 每层的作用

### `config/`

放 watchlist、LGA 优先级、筛选规则、评分阈值等可调配置。

### `data/raw/`

放未经修改的原始抓取结果，例如：

- Planning Proposals 页面快照
- policy 页面导出文本
- council tracker 抓取结果
- GIS 原始下载文件

### `data/interim/`

放清洗后的中间层，例如：

- 统一字段名后的 proposal 表
- precinct 对应表
- application activity 中间表
- constraints 归一化表

### `data/curated/`

放可直接驱动产品输出的主题表，例如：

- `opportunity_items`
- `policy_signals`
- `precincts`
- `watchlist_scoreboard`

### `schemas/`

放首批字段清单和字段字典，确保后续抓取、清洗、报告都使用一致命名。

### `reports/`

放周报样稿、deep dive 模板、site card 模板等客户可见输出。

## 推荐工作流

1. 把公开数据抓到 `data/raw/`
2. 在 `data/interim/` 做结构统一和基础匹配
3. 在 `data/curated/` 产出可直接用于报告的表
4. 根据 `config/priority-watchlist.md` 跑重点区域和 shortlist
5. 输出到 `reports/`

## 文件命名建议

- 原始快照：`source-name_YYYY-MM-DD.ext`
- 中间表：`table-name_YYYY-MM-DD.parquet`
- 主题表：`table-name_latest.parquet`
- 报告：`weekly-radar_YYYY-MM-DD.md`

## 最小上线标准

当以下 4 项都具备时，就可以开始试运行：

- 能稳定更新 `Planning Proposals` 和重点 policy signals
- 能生成第一版 `opportunity_items`
- 能输出一版 Top N shortlist
- 能产出一版周报和一版 deep dive 样稿
