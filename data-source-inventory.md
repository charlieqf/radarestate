# 数据源清单与采集优先级

## 目的

这份清单不是产品宣传材料，而是实际采集和研究的工作底稿。

目标是回答 4 个问题：

1. 哪些公开数据源真的能拿到
2. 哪些源适合稳定例行采集
3. 哪些源只能作为辅助研究层
4. 哪些结论和可视化值得在拿到数据后优先验证

## 首波最重要的数据源

### 1. Planning / Rezoning / Policy

- `Planning Proposals Online`
  - URL: `https://www.planningportal.nsw.gov.au/ppr`
  - 用途: 追踪 rezoning / LEP amendment 管线
  - 价值: 最接近“政策尚未完全 price in”的前置信号

- `Housing Targets`
  - URL: `https://www.planning.nsw.gov.au/policy-and-legislation/housing/housing-targets`
  - 用途: 判断 council 压力和政策方向
  - 价值: 可形成 target gap 和 LGA 排序

- `Urban Development Program`
  - URL: `https://www.planning.nsw.gov.au/data-and-insights/urban-development-program`
  - 用途: 观察 housing pipeline、supply context、infrastructure context
  - 价值: 是供给和政策之间的重要桥梁

- `Local Housing Strategies Tracker`
  - URL: `https://www.planningportal.nsw.gov.au/local-housing-strategies-tracker`
  - 用途: 判断 council 中长期住房战略成熟度
  - 价值: 更适合解释层，不是高频流水层

### 2. DA / Activity

- `Application Tracker`
  - URL: `https://www.planningportal.nsw.gov.au/map`
  - 用途: 看申请、开发活动、项目状态
  - 价值: 最直接的开发活动流水

- `Council Trackers Directory`
  - URL: `https://www.planningportal.nsw.gov.au/map/council-trackers`
  - 用途: 找到各 council 自有 tracker
  - 价值: 用来补足州级入口覆盖不足的部分

- `Major Projects`
  - URL: `https://www.planningportal.nsw.gov.au/major-projects/projects`
  - 用途: 观察 SSD / SSI 类型项目
  - 价值: 对大体量开发活动非常重要

### 3. Spatial / Constraints

- `Spatial Viewer`
  - URL: `https://www.planningportal.nsw.gov.au/spatialviewer`
  - 用途: 人工核验 zoning、planning controls、development opportunities
  - 价值: 作为核验工具非常强

- `Spatial Services Web Services`
  - URL: `https://www.spatial.nsw.gov.au/products_and_services/web_services`
  - 用途: 获取基础空间图层和服务
  - 价值: 适合做底图、边界和空间叠图基础设施

- `Planning Portal Open Data`
  - URL: `https://www.planningportal.nsw.gov.au/opendata`
  - 用途: 寻找 ArcGIS、JSON、WMS、WFS、XLSX 等正式公共数据入口
  - 价值: 是公开数据目录总入口

- `Biodiversity Values Map`
  - URL: `https://datasets.seed.nsw.gov.au/dataset/biodiversity-values-map`
  - 用途: 识别环境约束
  - 价值: 对 greenfield 和部分 infill 都是强约束层

- `Bush Fire Prone Land`
  - URL: `https://datasets.seed.nsw.gov.au/dataset/bush-fire-prone-land`
  - 用途: 识别 bushfire 约束
  - 价值: 直接影响筛选逻辑

- `Flood Data Portal`
  - URL: `https://flooddata.ses.nsw.gov.au/`
  - 用途: 识别 flood 风险和已发布 flood 研究
  - 价值: 非常重要，但数据结构可能更分散

### 4. Demographics / Demand Context

- `NSW Population Projections`
  - URL: `https://www.planning.nsw.gov.au/data-and-insights/population-projections/key-findings`
  - 用途: 需求端长期趋势

- `ABS Regional Population`
  - URL: `https://www.abs.gov.au/statistics/people/population/regional-population`
  - 用途: LGA / SA2 人口变化

- `ABS Data by Region`
  - URL: `https://www.abs.gov.au/databyregion`
  - 用途: 人口、收入、就业、行业背景

### 5. Infrastructure / Transport

- `Transport Open Data Hub`
  - URL: `https://opendata.transport.nsw.gov.au/`
  - 用途: 站点、线路、可达性和交通背景层

- `Infrastructure Funding`
  - URL: `https://www.planning.nsw.gov.au/plans-for-your-area/infrastructure-funding`
  - 用途: 观察政府资金和基础设施导向

## 采集难度

### 低

- Housing Targets
- Local Housing Strategies Tracker
- ABS Regional Population
- ABS Data by Region
- Major Projects
- Biodiversity Values Map
- Bush Fire Prone Land

### 中

- Planning Proposals Online
- Application Tracker
- Spatial Viewer
- Planning Open Data
- Urban Development Program
- Flood Data Portal
- Transport Open Data Hub

### 高

- 各 council 自有 tracker 的统一采集
- 大规模 PDF 文档结构化
- parcel 级跨源匹配

## 推荐采集顺序

1. 先建地理骨架：LGA、SA2、站点、重点 precinct
2. 再建核心流水：Planning Proposals、Application Tracker、Major Projects
3. 再加政策和供给层：Housing Targets、UDP、LHS
4. 再加 constraints：flood、bushfire、biodiversity
5. 再加需求背景层：人口、收入、就业
6. 最后再做解释性文档层和实验性层

## 舆情层：有价值，但不应一开始做成核心引擎

## 为什么值得考虑

- 它能补足“市场开始关注没有”的信息
- 它有时能比新闻更早反映 suburb narrative shift
- 它有时能帮助发现 `controversy`，而 controversy 本身可能是政策推进或市场分化的前兆

## 为什么不能直接当主引擎

- 论坛讨论的样本不代表真实买家和开发商总体
- 热度高不等于开发价值高
- 很多负面讨论反而可能对应未来被重定价的区域
- 平台 scraping 稳定性、条款和反爬限制更复杂

## 更合理的定义

不要把它定义成单纯的 `情感分数`。

更合理的是把它定义成：

- `Attention Velocity`：讨论量和增长速度
- `Narrative Shift`：讨论主题是否从边缘转向主流
- `Controversy Level`：正反意见是否同时升高
- `Topic Mix`：交通、学校、犯罪、洪水、gentrification、开发反对等主题占比

## 优先考虑的公开舆情源

### 1. Google Trends

- URL: `https://trends.google.com/trends/`
- 价值: 看 suburb 关键词和相关主题的搜索热度趋势
- 优点: 公开、宏观、容易解释
- 缺点: 不是房地产专属，且是相对指数而非绝对讨论量

### 2. Whirlpool Real Estate 公开讨论区

- URL: `https://forums.whirlpool.net.au/`
- 价值: 澳洲本地用户密度高，存在房地产与政策讨论
- 优点: 页面公开可见，适合低频观察与研究
- 缺点: 房地产讨论并非只按 suburb 组织，语义噪音较高

### 3. Reddit 公开社区和搜索结果

- 典型入口: `r/sydney`、`r/AusProperty`、相关搜索页面
- 价值: 适合识别更早期的 narrative shift 和争议点
- 优点: 内容丰富、话题广
- 缺点: 公开访问常有反爬和验证限制，稳定采集难度较高

### 4. 公开媒体与榜单内容

- 例如 suburb ranking、hot suburbs、local news、planning controversy 报道
- 价值: 适合看“舆情从小圈子扩散到大众媒体”这个阶段
- 缺点: 更偏结果，而非最早信号

### 5. Council `Have Your Say` / exhibition 页面

- 价值: 可作为准舆情层，反映真实本地政策争议和参与度
- 优点: 与规划主题强相关
- 缺点: 不一定有结构化评论或统一统计口径

## AI 在舆情层里真正该做什么

### 应该做

- suburb 和 precinct 名称识别
- 主题分类
- 是否与开发/规划相关的过滤
- 正面 / 负面 / 中性 / 争议型标签
- 事件抽取，比如交通、犯罪、学校、flood、rezoning 反对
- 趋势变化检测

### 不该过度相信

- 单一的正负面总分
- 把情感分析直接等价成投资信号
- 不区分“吐槽”和“可执行信息”的自动结论

## 建议定位

舆情层建议作为：

- `Tier 4` 实验性数据层
- 初期只用于报告中的辅助栏目和观察标签
- 在评分体系中权重不宜超过 `10%-15%`

## 最值得优先验证的结论

- 哪些 suburb / precinct 在政策信号出现后，讨论热度开始加速
- 哪些地区出现高争议但高关注的组合
- 舆情高点和 proposal / DA 进度之间是否有稳定 lead-lag 关系
- 哪些地方“媒体和论坛都在热议”，但结构化规划信号其实很弱

## 对可视化的影响

如果后续确实能稳定采到舆情层，最适合新增的图不是“情绪表盘”，而是：

- `Attention Trend by Precinct`
- `Narrative Shift Timeline`
- `Controversy vs Policy Progress`

这样比单一 sentiment gauge 更有解释力。
