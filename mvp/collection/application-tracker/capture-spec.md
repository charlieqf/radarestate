# Application Tracker 采集说明

## 数据源

- 名称: `Application Tracker`
- 入口: `https://www.planningportal.nsw.gov.au/map`

## 已确认的可用接口

- 普通 application 数据接口: `https://api.apps1.nsw.gov.au/eplanning/data/v0/DAApplicationTracker`
- state significant 数据接口: `https://www.planningportal.nsw.gov.au/state-significant-projects-spatial-data`

普通 application 接口已确认使用 `POST` JSON payload，前端默认使用的核心参数包括：

- `ApplicationStatus`
- `CouncilDisplayName`
- `ProjectTitle`
- `SiteAddress`
- `ApplicationType`
- `LodgementDateFrom`
- `LodgementDateTo`
- `PageNumber`
- `PageSize`

## 采集目标

首批只做“开发活动流水层”，先拿到能支撑排名、变化检测和 precinct activity summary 的字段。

## 原始采集对象

### 1. 结果列表页快照

优先关注：

- `Applications`
- `State Significant Applications`

### 2. 单 application 详情页或详情链接

### 3. 与 council / status / development type 相关的可见筛选信息

## 首批必抓字段

- `source_name`
- `project_name`
- `application_id_or_ref`
- `status_raw`
- `status_normalised`
- `council_raw`
- `development_type_raw`
- `address_raw`
- `lodged_date_raw`
- `detail_url`
- `observed_at`

从已验证样本看，真实返回字段至少包括：

- `PLANNING_PORTAL_APP_NUMBER`
- `COUNCIL_NAME`
- `STATUS`
- `TYPE_OF_DEVELOPMENT`
- `APPLICATION_TYPE`
- `LODGEMENT_DATE`
- `DETERMINATION_DATE`
- `FULL_ADDRESS`
- `geometry.coordinates`

## 可选字段

- `assessment_type`
- `industry_type`
- `application_category`
- `geometry_hint`

## 首批不做

- 一开始就完整覆盖全州所有 result page 组合
- 一开始就追求精确 geometry
- 一开始就统一所有 council 外链 tracker 结果

## 当前验证结论

- 公开 landing page 可以清楚读到筛选字段和用途说明
- 结果层不是直接渲染在 HTML 里，而是由前端脚本调用接口获取
- 普通 application 的结构化接口已经确认可用
- `State Significant` 的 JSON 端点也已经确认可用
- 前端默认 `PageSize = 4`，但接口已确认接受更大的 `PageSize`
- 这意味着它仍有适配工作，但已经从“未知难点”升级为“可接入的数据源”

## 最小产出

### Raw

- `applications` 搜索结果快照
- `state-significant` 搜索结果快照

### Interim

- `application_tracker_latest`
- `application_activity_by_lga`

### Curated

- `application_signals`

## 命名规范

原始文件建议：

- `application-tracker_applications_YYYY-MM-DD.html`
- `application-tracker_state-significant_YYYY-MM-DD.html`
- `application-detail_<slug>_YYYY-MM-DD.html`

## 更新频率

- 建议每周 `1-2` 次

## 质量检查

- 是否有明显重复记录
- status 是否能被稳定标准化
- council 名称是否与统一 LGA 字典匹配
- address 是否至少能落到 suburb / precinct

## 完成标准

- 能输出本周主要 activity 集中在哪些 LGA / precinct
- 能区分普通 applications 与 state significant activity
- 能为 Top N shortlist 提供 activity context
