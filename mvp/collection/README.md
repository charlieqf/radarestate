# 首波采集包

## 目的

这个目录专门放首波重点数据源的采集说明、字段映射和更新记录模板。

首批只覆盖 3 个源：

- `Planning Proposals Online`
- `Application Tracker`
- `Housing Targets`

## 结构

```text
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
```

## 使用方式

1. 先看 `capture-spec.md` 明确抓什么
2. 再按 `data/raw/` 对应目录保存原始快照
3. 每次更新时在对应 `update-log-template.csv` 里记录结果
4. 字段进入中间表前，先按 `schemas/` 下的 source mapping 统一字段名
