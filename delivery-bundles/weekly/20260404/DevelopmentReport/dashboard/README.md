# Dashboard

## 生成方式

```bash
npm run report:dashboard
```

输出文件：

- `dashboard/latest-report.html`

## 当前内容

- Precinct opportunity map
- Recent activity ranking
- Policy pipeline stage chart
- Target pressure vs recent activity scatter
- High-conviction council table
- Sydney proposal watchlist table
- Precinct shortlist
- Risk-adjusted precinct notes

这是第一版研究 dashboard，重点是：

- 直接从 Supabase views 出图
- 不依赖 mock JSON
- 先做 council-level / policy-level 视角

当前 `risk` 还是第一版代理层，主要来自：

- council-level heat vulnerability
- council-level tree canopy
- precinct-level withdrawn proposal friction
- sample-based bushfire spatial hits
- sample-based biodiversity spatial hits（当前可能为 0）
- flood study / dataset coverage metadata matched to precinct sample points
