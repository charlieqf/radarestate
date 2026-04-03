# 自动化方案

## 目标

把当前系统从“手动运行一串脚本”升级成稳定的日更 / 周更情报流水线。

## 推荐节奏

### 每日

目标：更新结构化数据和基础报告。

建议执行：

1. `sync_planning_proposals`
2. `sync_application_tracker`
3. `build_constraints_layer`
4. `build_precinct_shortlist`
5. `generate_dashboard`
6. `generate_weekly_radar`
7. `render_client_reports`

对应命令：

```bash
npm run pipeline:daily
```

### 每周

目标：输出更完整的客户包。

建议执行：

1. 刷新 Sydney 数据与 mapping
2. 刷新 Hunter 数据与 mapping
3. 重建统一 risk layer
4. 再输出 Sydney client pack
5. 再输出 Hunter client pack

对应命令：

```bash
npm run pipeline:weekly
```

## 产物层次

### Daily

- `dashboard/latest-report.html`
- `reports/weekly-radar-latest.md`
- `client-output/weekly-radar-latest.html`

### Weekly

- `dashboard/latest-report.html`
- `dashboard/newcastle-hunter-report.html`
- `reports/client-pack-latest.md`
- `reports/client-pack-newcastle-hunter.md`
- `reports/deep-dive-*.md`
- `client-output/index.html`
- `client-output/client-pack-latest.html`
- `client-output/client-pack-newcastle-hunter.html`
- `client-output/deep-dive-*.html`

## 调度方式

### 方案 A：GitHub Actions

优点：

- 云端自动运行
- 不依赖你的本地机器开机
- 可上传 artifacts

前提：

- 在 GitHub Secrets 里配置 `SUPABASE_DB_URL`

### 方案 B：Windows Task Scheduler

优点：

- 配置简单
- 直接使用本地 `supabase.txt`

缺点：

- 机器必须开机
- 本地网络、VPN、权限问题更容易影响运行稳定性

## 密钥处理

### GitHub Actions

不要提交 `supabase.txt`。

应使用：

- `SUPABASE_DB_URL` GitHub Secret

Workflow 运行时临时写入 `supabase.txt`，脚本即可复用当前逻辑。

### 本地任务计划

- 继续用本地未提交的 `supabase.txt`
- 确保文件权限仅你自己可读

## 失败处理

当前已经有 `runs/` manifest 输出，可用于后续告警。

建议后续加两类告警：

1. pipeline 某一步失败
2. 关键输出文件缺失

## 目前最现实的自动化路线

### 第一步

先在本地用：

```bash
npm run pipeline:daily
```

连续跑几天，确认：

- 数据同步稳定
- pipeline 耗时可接受
- 产物内容没有明显退化

### 第二步

把同样流程搬到 GitHub Actions：

- daily workflow
- weekly workflow

### 第三步

再加：

- 邮件/Slack 通知
- 失败重试
- 版本化报告归档

## 当前建议

先自动化 `daily` 和 `weekly` 两条固定流水线，不要一开始就做“实时”。

对这个项目来说，真正有价值的是：

- 稳定
- 可解释
- 每天能增量更新
- 每周能稳定产出客户包
