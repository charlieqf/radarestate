# Archive

自动化 pipeline 每次运行成功或失败后，都会把当前关键产物复制到这里。

结构：

- `archive/daily/<timestamp>/...`
- `archive/weekly/<timestamp>/...`

用途：

- 回看历史报告
- 比较本周与上周输出差异
- 发生失败时保留现场快照
