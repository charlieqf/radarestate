# 修正版周报复审

## 复审结论

这次修正版**确实修掉了一批明显的 QA 问题**，包括：

- 悉尼主报告中混入 Hunter / Newcastle 内容的问题已基本清除。
- 之前几个关键数字口径不一致的问题，现在补上了 scope note，解释了“全区域总量”和“配置 watchlist universe”不是同一口径。
- `top-site-screening-latest.md` 现在给 Top 12 全部补了 site card，不再只有前 5 个有卡片。
- 之前明显的编码清洗问题（如 `&Amp;`、中文顿号）已修复。

但这次修复**主要是表层 QA 修复**，还没有把产品提升成成熟、稳定、可直接支撑开发拿地判断的周报。仍然存在几个会影响信任和实用性的剩余问题。

## Findings

### 1. `St Leonards` 仍然把跨 jurisdiction 的站点混在同一个 watchlist bucket 里，表达方式仍然容易误导

严重性：中

相关位置：

- `reports/top-site-screening-latest.md:22-32`
- `reports/top-site-screening-latest.md:48-58`
- `reports/top-site-screening-latest.md:96-106`
- `reports/top-site-screening-latest.md:120-129`
- `reports/top-site-screening-latest.md:168-177`
- `reports/site-card-latest-precinct-st-leonards-11-dp1013030.md:9-12`
- `reports/site-card-latest-precinct-st-leonards-sp73564.md:9-12`

现在他们没有再把这类差异“藏起来”，而是明确写了：

- `Watchlist precinct: St Leonards`
- `Current precinct grouping: North Sydney`
- `Apparent site jurisdiction from governing EPI: Willoughby`

这比旧版诚实，但问题没有真正解决：**同一个 watchlist bucket 仍然跨不同 LEP / jurisdiction**。对开发商来说，这会直接增加误读成本，因为：

- 你看到 `St Leonards` 可能自然会按单一市场或单一 planning context 理解。
- 但实际 site card 又告诉你 governing EPI 是另一个 jurisdiction。
- 这说明系统的 search bucket 设计仍然粗，容易让“区域标签”掩盖真实控规归属。

这已经不是纯文案问题，而是产品结构问题。

### 2. 修正版仍把明显需要 strata/title 特别核查的目标打成 `Advance`，对小开发商可执行性判断仍偏弱

严重性：中

相关位置：

- `reports/site-card-latest-precinct-edgecliff-sp21608.md:12-18`
- `reports/site-card-latest-precinct-edgecliff-sp21608.md:77-84`
- `reports/site-card-latest-precinct-st-leonards-sp73564.md:12-18`
- `reports/site-card-latest-precinct-st-leonards-sp73564.md:45-49`
- `reports/site-card-latest-precinct-st-leonards-sp73564.md:77-84`
- `reports/top-site-screening-latest.md:25`
- `reports/top-site-screening-latest.md:28`
- `reports/development-report-standard-universe.md:85`
- `reports/development-report-standard-universe.md:147`
- `reports/development-report-standard-universe.md:167`

修正版虽然更明确地提醒了 `strata/title structure check`，但筛选逻辑本身没有变：

- `180 OCEAN STREET EDGECLIFF` 仍然是 `Advance`
- `205 PACIFIC HIGHWAY ST LEONARDS` 仍然是 `Advance`
- 固定样本中的 `11/32 KITCHENER PARADE BANKSTOWN` 仍然是 `Advance`

其中：

- `205 PACIFIC HIGHWAY ST LEONARDS` 是 `SP73564`，`ValNet type = UNDERSP`，`ValNet lot count = 69`
- `180 OCEAN STREET EDGECLIFF` 也是 `SP21608`，并明确要求 strata/title check

这说明系统**仍会把潜在 strata / complex title / assembly-poor 目标排进高优先级候选**。对于小开发商，这种“先推上来，再提醒你自己查 title”的逻辑，实操价值仍然偏弱。

### 3. 他们修复了“数字口径未说明”的问题，但没有真正把 scope 设计成一眼就清楚

严重性：中

相关位置：

- `reports/weekly-radar-latest.md:13-19`
- `reports/weekly-radar-latest.md:29-34`
- `reports/coverage-readiness-greater-sydney-expanded.md:22-27`
- `reports/top-10-insights-latest.md:77-82`

优点是他们已经承认：

- region totals
- configured precinct watchlists
- ranked site-screening outputs

不是同一个 universe。

但问题在于：**这个解释还是停留在说明层，不是结构层**。客户仍然需要自己不断切换脑子去判断：

- 这个数字是 Sydney 全量？
- 还是 56 个 precinct 的配置 universe？
- 还是 top ranked site cut？

换句话说，他们把“口径不一致”从隐性错误，改成了“显性但仍然费脑的设计”。这算改进，但还不能算真正解决。

### 4. `Top 10 Insights` 仍残留模板化措辞，说明最终人工审校仍不够细

严重性：低

相关位置：

- `reports/top-10-insights-latest.md:84-86`
- `reports/client-pack-latest.md:31-33`

`Top 10 Insights` 结尾仍写：

- `regionally viable but lower-conviction precincts`

这是从旧版 Hunter / Sydney 混合叙述里残留下来的语气，在这份 Sydney-only 文档里显得不够贴切。`client-pack-latest.md` 里也还保留了 `cross-market context` 这种偏模板化说法。

这不算大错，但说明**人工审校更像“把明显 bug 擦掉”，不是“按客户视角逐页打磨”**。

### 5. 深度页仍有低级文案粗糙痕迹，说明 QA 主要集中在主报告，没完全覆盖 supporting pages

严重性：低

相关位置：

- `reports/deep-dive-bankstown.md:27-29`
- `reports/deep-dive-gladesville.md:27-30`
- `reports/deep-dive-gladesville.md:41`

例子包括：

- bullet 仍然小写起句：`policy momentum...`, `recent development activity...`, `there is already...`
- `Gladsville` 这类拼写看起来仍然可疑

这不影响核心排序结果，但会继续削弱“这是一份认真打磨的付费产品”的观感。

## 已修复的问题

这次确实修掉了这些：

- 悉尼主包中混入 `weekly-radar-newcastle-hunter.md` 的问题已修复：`reports/top-10-insights-latest.md:9-13`
- 原来 Hunter / Newcastle 的三条 insight 已被 Sydney-only 内容替换：`reports/top-10-insights-latest.md:63-82`
- `weekly-radar-latest.md` 已明确标注 snapshot 是 full region totals：`reports/weekly-radar-latest.md:18`
- `coverage-readiness-greater-sydney-expanded.md` 已明确标注只描述 configured precinct universe：`reports/coverage-readiness-greater-sydney-expanded.md:22`
- Top 12 站点现在都已补 site card：`reports/client-pack-latest.md:14-25`
- `&Amp;` 编码问题已修正：`reports/deep-dive-bankstown.md:39-40`

## 这次修正版对价格判断的影响

和旧版相比，这份修正版的质量**明显更好**，因为它已经从“有明显 QA 漏洞的 beta 周报”提升到“可以稳定阅读的公开数据筛选周报”。

仍然没有解决的问题：

- 仍会把 strata/complex title 风险较高的站点打进 `Advance`
- watchlist bucket 与真实 jurisdiction 的错位问题只是披露了，没有真正结构化解决
