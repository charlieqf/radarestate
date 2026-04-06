# Scripts

## 安装

```bash
npm install
```

## 1. 初始化 Supabase schema 并导入当前样本

```bash
npm run supabase:apply
```

## 自动化入口

### Daily Pipeline

```bash
npm run pipeline:daily
```

包含 Hunter regional daily：

```bash
npm run pipeline:daily -- --include-regional-daily
```

### Weekly Pipeline

```bash
npm run pipeline:weekly
```

默认 weekly pipeline 现在会同时生成：

- Sydney weekly snapshot
- Sydney dated full report
- Sydney dated delta report if an earlier formal snapshot exists
- Sydney methodology appendix
- Sydney client pack
- Newcastle-Hunter client pack

默认 Sydney mainline pipeline 当前使用：

- `mvp/config/application-sync-greater-sydney-expanded.json`
- `mvp/config/planning-proposal-sync-greater-sydney-expanded.json`
- `mvp/config/precinct-focus-map-greater-sydney-expanded.json`

也就是说，`npm run pipeline:daily` 和 `npm run pipeline:weekly` 默认跑的是扩展后的 Sydney production scope，而不是最早的 focus-only 基础包。

Greater Sydney weekly flow is now split into two layers:

1. Production layer
- `create_weekly_snapshot.mjs`
- `generate_full_report.mjs`
- `generate_delta_report.mjs`
- `generate_methodology_appendix.mjs`

2. Assembly layer
- `generate_client_pack.mjs`
- `export_delivery_bundle.mjs`

`generate_client_pack.mjs` is now a lightweight pack assembler. It should aggregate already-generated dated outputs rather than regenerate the full reporting stack.

如果只想跑 Sydney weekly pack：

```bash
node scripts/run_pipeline.mjs --mode=weekly --skip-hunter-pack
```

如果同一天的 snapshot 已经存在、需要覆盖重跑：

```bash
node scripts/run_pipeline.mjs --mode=weekly --skip-hunter-pack --overwrite-snapshot
```

指定 dated snapshot：

```bash
node scripts/run_pipeline.mjs --mode=weekly --skip-hunter-pack --snapshot-date=2026-04-05 --previous-snapshot-date=2026-03-29
```

如果不传 `--previous-snapshot-date`，weekly pipeline 会自动从 `snapshots/weekly/` 里寻找比当前日期更早的最近一份 `formal` snapshot。

如果只存在 `reconstructed` 历史点，默认不会自动拿它做 delta 基线。

如果你明确要生成过渡期 delta，必须显式允许：

```bash
node scripts/run_pipeline.mjs --mode=weekly --skip-hunter-pack --snapshot-date=2026-04-05 --previous-snapshot-date=2026-03-29 --allow-reconstructed-previous
```

过渡期的 `2026-03-29` 这类基线不应被称为正式 full report。应使用 reconstructed baseline 口径。

直接生成 reconstructed baseline snapshot：

```bash
node scripts/create_reconstructed_baseline_snapshot.mjs --snapshot-date=2026-03-29 --region-group="Greater Sydney" --label="Sydney"
```

直接生成 dated full report：

```bash
node scripts/generate_full_report.mjs --snapshot-date=2026-04-05 --region-group="Greater Sydney" --label="Sydney"
```

直接生成 dated delta report：

```bash
node scripts/generate_delta_report.mjs --current-date=2026-04-05 --previous-date=2026-03-29 --region-group="Greater Sydney" --label="Sydney"
```

这两个命令会把同步、构建和报告串起来，并把运行清单写到 `runs/`。
成功或失败后，还会把关键产物归档到 `archive/`。

### Coverage Readiness Evaluation

```bash
npm run coverage:evaluate -- --precinct-config=mvp/config/precinct-focus-map-greater-sydney-expanded.json --name=greater-sydney-expanded
```

输出：

- `reports/coverage-readiness-<name>.md`

用于判断扩区前的 3 个关键问题：

- precinct mapping
- risk layer availability
- shortlist/report stability

### Newcastle-Hunter Regional Bundle

```bash
npm run report:hunter
```

输出：

- `dashboard/newcastle-hunter-report.html`
- `reports/weekly-radar-newcastle-hunter.md`
- `client-output/weekly-radar-newcastle-hunter.html`

这条命令用于生成 Hunter 区域的专属 dashboard 和 weekly radar。

## 2. 同步 Application Tracker 到 Supabase

默认会：

- 读取 `mvp/config/application-sync-focus-councils.json`
- 抓取 focus councils 的 recent applications
- 更新 `application_signals`
- 更新 `council_activity_counts`
- 可选同步 focus councils 相关的 state significant rows

```bash
npm run sync:applications
```

### 可选参数

```bash
node scripts/sync_application_tracker.mjs --recent-from=2025-01-01 --page-size=200
```

```bash
node scripts/sync_application_tracker.mjs --recent-from=2025-01-01 --page-size=200 --max-pages=2
```

```bash
node scripts/sync_application_tracker.mjs --skip-ssa
```

```bash
node scripts/sync_application_tracker.mjs --councils=Parramatta,Canterbury-Bankstown,Liverpool --page-size=500
```

如果 council 名称里有空格，整段参数要加引号：

```bash
node scripts/sync_application_tracker.mjs "--councils=Inner West,North Sydney,Campbelltown" --page-size=500
```

## 说明

- Supabase 连接串从 `supabase.txt` 读取
- 默认优先尝试直连，失败时回退到 `pooler`
- `Application Tracker` 的 ordinary applications 使用公开 POST API
- `State Significant` 使用公开 JSON 端点
- 配置文件支持 `extends`，可用 `--config=` 传入 coverage pack
- 直接单跑 `sync_application_tracker.mjs` 时，默认仍读取 `mvp/config/application-sync-focus-councils.json`；但 `run_pipeline.mjs` 的 Sydney 主线默认会传入 expanded config

## 3. 同步 Planning Proposals 到 Supabase

默认会：

- 读取 `mvp/config/planning-proposal-sync.json`
- 按 stage + focus council 过滤列表页
- 自动分页
- 更新 `planning_proposals`
- 更新 `planning_proposal_stage_history`

```bash
node scripts/sync_planning_proposals.mjs
```

### 可选参数

```bash
node scripts/sync_planning_proposals.mjs --stages=under_assessment,pre_exhibition --max-pages=2
```

```bash
node scripts/sync_planning_proposals.mjs "--councils=Canada Bay,Inner West,Sutherland Shire"
```

也支持：

```bash
node scripts/sync_planning_proposals.mjs --config=mvp/config/planning-proposal-sync-greater-sydney-expanded.json
```

`run_pipeline.mjs` 的 Sydney 主线默认会使用 `mvp/config/planning-proposal-sync-greater-sydney-expanded.json`。

## 4. 生成研究 Dashboard

```bash
npm run report:dashboard
```

输出：

- `dashboard/latest-report.html`

## 4A. 生成 Hero Visual Pack

```bash
npm run report:hero
```

输出：

- `dashboard/hero-visual-pack.html`

主打：

- `Opportunity vs Risk Matrix`
- `Risk Stack`

## 4B. 生成 Top 10 Insights Memo

```bash
npm run report:insights
```

输出：

- `reports/top-10-insights-latest.md`

运行完后再执行：

```bash
npm run report:html
```

即可得到：

- `client-output/top-10-insights-latest.html`

## 5. 生成 Weekly Radar Memo

```bash
npm run report:weekly
```

输出：

- `reports/weekly-radar-latest.md`

默认会：

- 直接读取当前 Supabase views
- 生成 point-in-time 的 weekly radar memo
- 输出 headline、top precinct hotlist、risk table、council scoreboard、policy pipeline 和 proposal watchlist

## 6. 生成 Precinct Deep Dive Memo

```bash
npm run report:deepdive
```

输出：

- `reports/deep-dive-<precinct>.md`

默认会：

- 自动选择当前 shortlist 中最强的 precinct
- 拉取该 precinct 的 policy、activity、risk、council context
- 生成客户可读的 deep dive memo

可选参数：

```bash
node scripts/generate_deep_dive_memo.mjs --precinct="Five Dock"
```

也支持指定引用的 dashboard / radar：

```bash
node scripts/generate_deep_dive_memo.mjs --precinct="Mayfield" --dashboard-path=dashboard/newcastle-hunter-report.html --radar-path=reports/weekly-radar-newcastle-hunter.md
```

### 批量生成 Deep Dives

```bash
npm run report:deepdives -- --config=mvp/config/deep-dive-newcastle-hunter.json
```

### Hunter Deep Dives

```bash
npm run report:hunter:deepdives
```

当前手工配置默认会生成：

- `Mayfield`
- `Newcastle City Centre`
- `Cessnock`

### Hunter Client Pack

```bash
npm run report:hunter:pack
```

输出：

- `dashboard/newcastle-hunter-report.html`
- `reports/weekly-radar-newcastle-hunter.md`
- `reports/client-pack-newcastle-hunter.md`
- `client-output/client-pack-newcastle-hunter.html`
- 对应 Hunter deep dives HTML / markdown

当前 Hunter client pack 的 deep dives 不再依赖固定配置，而是动态选择：

- best current opportunity precinct
- strongest additional core precinct
- highest-friction precinct

## 7. 生成 Client Pack

```bash
npm run report:pack
```

输出：

- `dashboard/latest-report.html`
- `reports/weekly-radar-latest.md`
- `reports/deep-dive-<top-precinct>.md`
- `reports/deep-dive-<top-risk-precinct>.md`
- `reports/client-pack-latest.md`

默认会：

- 生成 visual dashboard
- 生成 weekly radar memo
- 生成一个 top opportunity deep dive
- 生成一个 top risk deep dive
- 写一份 pack index 说明推荐阅读顺序
- 自动渲染 `client-output/` HTML 客户版报告

## 8. 渲染 HTML 客户报告

```bash
npm run report:html
```

输出：

- `client-output/index.html`
- `client-output/client-pack-latest.html`
- `client-output/weekly-radar-latest.html`
- `client-output/deep-dive-*.html`

默认会：

- 读取 `reports/` 下当前 markdown 报告
- 渲染为统一风格的 HTML memo
- 生成一个带侧边导航的 client portal

## 8A. 导出单一客户交付目录

```bash
npm run report:bundle
```

输出：

- `delivery-bundles/latest/`
- `delivery-bundles/weekly/YYYYMMDD/`

其中包含：

- `RadarReport/`
- `DevelopmentReport/`

这两套目录都可以直接整体发给客户使用。

说明：

- `RadarReport/` 是每周固定产出的 intelligence layer
- `DevelopmentReport/` 是开发商硬信息层、单独定价的报告层
- 默认包含一份固定热点范围的 weekly development report
- 未来可以在此基础上再加入 client-tailored site universes

## 9. 构建 Precinct Mapping 与 Shortlist

```bash
npm run build:precincts
```

默认会：

- 读取 `mvp/config/precinct-focus-map.json`
- 把 focus precinct 写入 `precincts`
- 将 `planning_proposals` 和 `application_signals` 做关键词映射
- 刷新 precinct summary views
- 重建 `opportunity_items` 的 precinct shortlist

可扩展运行：

```bash
node scripts/build_precinct_shortlist.mjs --config=mvp/config/precinct-focus-map-greater-sydney-expanded.json
```

`run_pipeline.mjs` 的 Sydney 主线默认会使用 `mvp/config/precinct-focus-map-greater-sydney-expanded.json`。

## 10. 构建第一版 Constraints Layer

```bash
npm run build:constraints
```

默认会：

- 创建 / 更新 `constraints` 表
- 基于已验证公开数据生成第一版风险代理项
- 当前包括：
  - `heat_vulnerability_proxy`
  - `low_tree_canopy_proxy`
  - `policy_withdrawal_friction`
  - `biodiversity_spatial_sample`
  - `bushfire_spatial_sample`
  - `flood_metadata_signal`

注意：

- 这仍是 `first-pass proxy layer`
- `biodiversity_spatial_sample` 和 `bushfire_spatial_sample` 基于 mapped recent application points 的 sample-based spatial hit
- `flood_metadata_signal` 基于 Flood Data Portal 的公开 metadata/project coverage，并要求与 mapped recent application points 的空间覆盖相交
- 还不是 parcel 级 flood / bushfire / heritage 最终判定
- 运行完后建议再执行一次 `npm run build:precincts`
