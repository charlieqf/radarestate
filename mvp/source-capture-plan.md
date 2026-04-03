# 数据源逐项落地清单

## 目标

把“有哪些数据源”进一步变成“每个源具体抓什么、先抓到什么程度就够了”。

## 1. Planning Proposals Online

### 入口

- `https://www.planningportal.nsw.gov.au/ppr`

### 首批要抓的内容

- proposal 标题
- stage
- LGA
- location_text
- 文档链接
- 最近观察日期

### 暂时不强求

- 每个 proposal 的完整文档解析
- 非结构化文本里的全部地块信息

### 更新频率

- 每周 2-3 次

### 自动化等级

- 中

### 是否值得首波

- 是，必须

## 2. Application Tracker

### 入口

- `https://www.planningportal.nsw.gov.au/map`

### 首批要抓的内容

- project name
- status
- council
- development type
- address / location text
- lodged date
- source URL

### 暂时不强求

- 所有结果的精确 geometry
- 所有扩展字段全量抓取

### 更新频率

- 每周 1-2 次

### 自动化等级

- 中

### 是否值得首波

- 是，必须

## 3. Council Trackers Directory

### 入口

- `https://www.planningportal.nsw.gov.au/map/council-trackers`

### 首批要抓的内容

- council 名称
- tracker 链接
- tracker 类型备注

### 暂时不强求

- 全部 council 同步接入

### 更新频率

- 月度检查

### 自动化等级

- 低

### 是否值得首波

- 是，用于建立补充路线图

## 4. Major Projects

### 入口

- `https://www.planningportal.nsw.gov.au/major-projects/projects`

### 首批要抓的内容

- project title
- project type
- location
- status
- source link

### 更新频率

- 每周

### 自动化等级

- 低到中

### 是否值得首波

- 是

## 5. Housing Targets

### 入口

- `https://www.planning.nsw.gov.au/policy-and-legislation/housing/housing-targets`

### 首批要抓的内容

- council 名称
- 目标口径
- 时间窗口
- snapshot / source link

### 更新频率

- 月度检查

### 自动化等级

- 低

### 是否值得首波

- 是

## 6. Urban Development Program

### 入口

- `https://www.planning.nsw.gov.au/data-and-insights/urban-development-program`

### 首批要抓的内容

- dashboard 口径说明
- 可用指标列表
- 地理层级
- 时间口径
- 相关 dashboard 或下载入口

### 暂时不强求

- 一开始就把所有 dashboard 数值自动化入库

### 更新频率

- 月度

### 自动化等级

- 中

### 是否值得首波

- 是

## 7. Spatial Viewer / Planning Open Data

### 入口

- `https://www.planningportal.nsw.gov.au/spatialviewer`
- `https://www.planningportal.nsw.gov.au/opendata`

### 首批要抓的内容

- 可用图层目录
- 重点图层名称
- 数据格式
- 服务或下载链接

### 暂时不强求

- 把所有规划图层都纳入

### 更新频率

- 月度

### 自动化等级

- 中

### 是否值得首波

- 是，尤其是做空间核验时

## 8. Biodiversity Values Map

### 入口

- `https://datasets.seed.nsw.gov.au/dataset/biodiversity-values-map`

### 首批要抓的内容

- 数据下载链接
- 数据版本日期
- coverage
- layer 名称

### 更新频率

- 月度检查

### 自动化等级

- 低

### 是否值得首波

- 是

## 9. Bush Fire Prone Land

### 入口

- `https://datasets.seed.nsw.gov.au/dataset/bush-fire-prone-land`

### 首批要抓的内容

- 图层下载链接
- 版本日期
- LGA 适用范围

### 更新频率

- 月度检查

### 自动化等级

- 低

### 是否值得首波

- 是

## 10. Flood Data Portal

### 入口

- `https://flooddata.ses.nsw.gov.au/`

### 首批要抓的内容

- flood project 索引
- dataset 索引
- 组织信息
- 覆盖区域说明

### 暂时不强求

- 立刻统一全部 flood study 数据结构

### 更新频率

- 月度

### 自动化等级

- 中

### 是否值得首波

- 是，但先做目录层

## 11. ABS Regional Population

### 入口

- `https://www.abs.gov.au/statistics/people/population/regional-population`

### 首批要抓的内容

- LGA / SA2 人口变化表
- 时间范围
- geography keys

### 更新频率

- 年度

### 自动化等级

- 低

### 是否值得首波

- 是

## 12. ABS Data by Region

### 入口

- `https://www.abs.gov.au/databyregion`

### 首批要抓的内容

- 人口
- 收入
- 就业
- 行业结构
- geography 对应关系

### 更新频率

- 按发布频率复核

### 自动化等级

- 低到中

### 是否值得首波

- 是

## 13. Transport Open Data Hub

### 入口

- `https://opendata.transport.nsw.gov.au/`

### 首批要抓的内容

- 站点和线路相关公开目录
- geospatial 数据入口
- 是否需要登录 / 注册
- 哪些数据集真的对 precinct 分析有用

### 暂时不强求

- 一开始就接实时 API

### 更新频率

- 月度

### 自动化等级

- 中

### 是否值得首波

- 是，但聚焦站点和线路相关静态或可下载层

## 14. 舆情实验层

### 首批只做 3 个源

- Google Trends
- Whirlpool Real Estate
- Council `Have Your Say` 页面

### 暂时不做

- 全量 Reddit 自动抓取
- 跨平台全网情绪监测

### 首批目标

- 先判断是否能形成 `attention trend`
- 再判断是否值得做更深 AI 语义分析

## 判断一个源是否继续投入的标准

- 是否能稳定更新
- 是否能形成结构化字段
- 是否能直接改善 shortlist 质量
- 是否能支撑至少一种重复使用的图表
- 是否能减少人工判断成本
