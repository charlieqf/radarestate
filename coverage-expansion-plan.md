# 地区扩大方案

## 核心原则

不要一次性从 `当前重点 Greater Sydney precinct` 直接跳到 `全 NSW 全量覆盖`。

更稳的扩法是：

1. 先扩 `council filters`
2. 再扩 `precinct packs`
3. 再扩 `risk layers`
4. 最后再扩报告和客户包

也就是说：

`先扩采集边界，再扩映射边界，最后扩结论边界。`

## 最推荐的扩张顺序

### 第 1 阶段：Greater Sydney 扩全

当前系统已经覆盖了重点 council 和一批高价值 precinct。

接下来最自然的是把 Greater Sydney 内还没系统覆盖的区域继续补齐，例如：

- Burwood / Strathfield 周边更细 precinct
- Canterbury-Bankstown / Georges River 继续下沉
- North Sydney / Lane Cove / Willoughby 边界 precinct
- The Hills / Penrith / Blacktown 的增长走廊 precinct

这是性价比最高的一步，因为：

- 数据源结构基本已知
- 现有 scoring 逻辑还能复用
- 可视化和报告模板不需要重做

### 第 2 阶段：NSW Metro Fringe

如果要出 Sydney 以外的第二圈，优先建议：

- Newcastle / Lake Macquarie
- Wollongong / Shellharbour
- Central Coast

原因：

- 公开规划和 flood 数据通常仍较丰富
- 市场规模足够，值得做 B2B intelligence
- 不至于像更偏远区域那样，数据稀疏到很难做稳定 shortlist

### 第 3 阶段：Selective NSW Coverage

只建议做“有明确客户需求的点状扩张”，不要直接全州铺开。

例如：

- 某条 transport corridor
- 某个 regional city
- 某个已知有 rezoning / housing pressure 的 LGA cluster

## 扩张时最关键的 4 个工作包

## 1. Application Sync Config

要扩地区，第一件事不是改代码，而是加新的 application sync config。

当前已经支持：

```bash
node scripts/sync_application_tracker.mjs --config=<path>
```

所以你只需要新增新的 council 配置文件，例如：

- `mvp/config/application-sync-focus-councils-expanded.json`
- `mvp/config/application-sync-newcastle.json`

配置里定义：

- `recentFrom`
- `pageSize`
- `councils[]`

## 2. Planning Proposal Sync Config

同样，proposal 同步也已经支持：

```bash
node scripts/sync_planning_proposals.mjs --config=<path>
```

扩区域时要新增：

- stage 抓取范围
- council filter 值

优先用 config 扩，不要复制脚本。

## 3. Precinct Focus Map

真正决定你能不能出 shortlist 的，不是 council 数量，而是 `precinct mapping`。

当前已经支持：

```bash
node scripts/build_precinct_shortlist.mjs --config=<path>
```

扩区域时，每新增一批地区，都要补：

- `precinct code`
- `name`
- `type`
- `primaryCouncil`
- `allowedCouncils`
- `policyTheme`
- `watchPriority`
- `keywords`

这里是扩张的真正瓶颈。

## 4. Risk Layer Availability

不是所有新地区都能立刻吃到同样质量的风险层。

扩区域前，先回答：

- bushfire spatial query 是否同样可用
- biodiversity spatial query 是否同样可用
- flood portal metadata 是否有足够 study coverage
- housing target / council snapshot 是否存在同口径字段

如果答案是否定的，就要允许新地区先以较轻的 risk stack 上线。

## 技术上怎么扩最稳

## 推荐方式：Coverage Pack

每扩一块地区，就做 3 个 config 文件：

1. application sync config
2. planning proposal sync config
3. precinct focus map

然后通过 pipeline 参数运行：

```bash
node scripts/run_pipeline.mjs --mode=daily --application-config=<...> --proposal-config=<...> --precinct-config=<...>
```

这比改脚本本身稳定得多。

## 不推荐方式

- 不要把所有地区硬塞进同一个巨大 config
- 不要复制出 `sync_application_tracker_newcastle.mjs` 这种分叉脚本
- 不要在 shortlist 逻辑里写死某个地区特判，除非真的无法避免

## 扩张节奏建议

### Daily

只跑核心覆盖区。

### Weekly

跑核心区 + 次重点扩展区。

### Monthly 或按需

刷新更外围区域、低优先级区域、或新客户要求的专题区域。

## 什么时候说明“已经可以扩”

至少同时满足：

1. 新地区 council / proposal / precinct config 已齐
2. 至少有一层 activity 数据能稳定抓到
3. 至少有一层 policy 数据能稳定抓到
4. 至少有一层 risk 数据可接
5. 能生成基础 weekly radar 和 precinct shortlist

如果只满足 1-2 条，不建议急着对外说“已覆盖该地区”。

## 最现实的下一步扩张建议

如果你要继续扩大，我建议按这个顺序：

1. 把 Greater Sydney precinct pack 补得更密
2. 新建一个 `greater-sydney-expanded` config 组
3. 等 expanded 稳定后，再新建 `newcastle` 或 `wollongong` pack

这样扩张出来的每一步都能继续出报告，而不是只是在数据库里堆更多噪音。
