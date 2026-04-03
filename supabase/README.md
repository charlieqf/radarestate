# Supabase 数据层

## 目标

把当前项目从“文件驱动的研究样本”升级成“数据库驱动的持续研究底座”。

原则：

- `raw files` 继续保留在本地文件夹或 `Supabase Storage`
- `structured tables` 进入 `Supabase Postgres`
- `chart-ready views` 直接在数据库里生成

## 文件

- `schema.sql`
  - 最小可用数据库 schema
- `views.sql`
  - 第一版分析视图
- `import-playbook.md`
  - 从当前样本文件迁移到 Supabase 的导入方案
- `..\scripts\supabase_apply_and_load.mjs`
  - 直接应用 schema、加载当前样本并做基础验证
- `..\scripts\sync_application_tracker.mjs`
  - 分页抓取 focus councils 的 DA activity 并直接 upsert 到 Supabase
- `..\scripts\sync_planning_proposals.mjs`
  - 按 stage + council 过滤抓取 planning proposals 并直接 upsert 到 Supabase

## 当前建议

- `CSV` 只保留为 raw/interim 导出物，不再作为 source of truth
- 正式分析和后续产品化都以 `Supabase` 为准
- 先上最小 schema，不要一开始做重平台
