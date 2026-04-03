# 舆情层采集与 AI 分析框架

## 定位

舆情层不是主引擎，而是 `辅助解释层 + 注意力变化层`。

它的作用不是直接回答“值不值得买”，而是回答：

- 市场开始讨论了吗
- 讨论在升温还是降温
- 讨论重点是什么
- 讨论是偏共识还是偏争议

## 优先问题

在你这个项目里，舆情层最该回答的不是情绪本身，而是：

1. 哪些 precinct / suburb 的讨论热度在加速
2. 哪些讨论和规划 / 开发主题相关
3. 哪些区域出现高争议而非单纯高热度
4. 舆情与 policy / proposal / DA 之间有没有时间差关系

## 首批数据源

### 1. Google Trends

适合做：

- suburb 搜索热度趋势
- 与交通、学校、洪水、开发等关键词的组合比较
- 高层级 narrative shift

不适合做：

- 精确讨论量
- 细粒度房地产情绪判断

### 2. Whirlpool Real Estate

适合做：

- 澳洲本地房地产讨论主题扫描
- 与 suburb 或政策相关的公开讨论

不适合做：

- 精准代表整体市场观点
- 高度自动化的大规模跨帖深度解析作为首版方案

### 3. Council `Have Your Say` / exhibition 页面

适合做：

- 规划相关本地反应
- 是否存在明显争议和参与度升高

不适合做：

- 标准化 sentiment scoring

### 4. Reddit

适合作为后续增强，不建议首批投入太多。

原因：

- 访问稳定性差
- 反爬更强
- suburb 命名和语义噪音都更高

## 分析单元

不要直接按“帖子”做最终结论。

建议用 3 层分析单元：

### 层 1：Mention

一条帖子、一条评论、一个标题或一个搜索指数点。

### 层 2：Topic Event

把多个 mention 聚合成事件主题，例如：

- 新 metro 站利好
- rezoning 反对
- 学区 / 家庭友好叙事升温
- flood 风险担忧

### 层 3：Precinct Narrative

把多个事件再聚合到 precinct / suburb 层，形成一个周期性的 narrative summary。

## AI 管线

### Step 1: 地名识别

识别文本中的：

- suburb 名称
- station 名称
- LGA 名称
- 重要 precinct 名称

### Step 2: 房地产相关过滤

把与项目无关的讨论排除掉。

只保留这几类主题：

- 规划和开发
- 交通和基础设施
- 居住吸引力
- 风险与争议
- 市场关注度

### Step 3: 主题分类

建议首批就分成固定主题，不追求开放式无穷分类。

首批主题建议：

- planning / rezoning
- transport / accessibility
- schools / family appeal
- safety / crime
- flood / bushfire / environment
- affordability / pricing pressure
- gentrification / neighbourhood change
- anti-development / local opposition

### Step 4: 情绪与争议识别

不要只做正负面二分类。

建议至少输出：

- positive
- negative
- neutral
- mixed / controversial

### Step 5: 事件抽取

抽取对分析有用的句子级结论，例如：

- “居民担心高密度带来交通拥堵”
- “讨论焦点从犯罪转向交通利好”
- “某地 flood concern 被反复提及”

### Step 6: 趋势检测

输出每个 precinct 的：

- attention change
- topic change
- controversy change

## 关键指标

### 1. Attention Velocity

表示讨论量或搜索热度的变化速度。

### 2. Narrative Concentration

表示讨论是否聚焦在少数几个高价值主题上。

### 3. Controversy Level

表示正反方向是否同时升高。

### 4. Planning Relevance Score

表示舆情中有多少内容和规划 / 开发机会真正相关。

### 5. Signal-to-Noise Ratio

表示有用信息占比，而不是总噪音量。

## 推荐输出

### 对内部研究

- `precinct_attention_trend`
- `precinct_topic_mix`
- `precinct_controversy_summary`
- `narrative_shift_events`

### 对外部报告

- 一条 precinct narrative 摘要
- 一个注意力趋势图
- 一段“为什么市场开始讨论它”的解释

## 推荐图表

### 1. Attention Trend by Precinct

对比多个 precinct 的热度变化。

### 2. Narrative Shift Timeline

展示主题焦点如何随时间变化。

### 3. Controversy vs Policy Progress

把高争议点和 proposal / policy 节点叠在一起。

## 不建议做的东西

- 单一的 `sentiment gauge`
- 脱离主题分类的情绪平均分
- 把论坛热度直接当作开发价值代理变量
- 在首版里做跨平台全自动实时监控

## 首批验证任务

### Task 1

选 `10-20` 个重点 precinct / suburb，拉 Google Trends 观察趋势差异。

### Task 2

人工抽样 `Whirlpool` 和 `Have Your Say` 内容，看能否稳定识别主题和争议。

### Task 3

把舆情高点和 Planning Proposal / DA 进度做简单时间对照。

### Task 4

判断哪些 precinct 的舆情层有解释力，哪些只有噪音。

## 上线原则

只有在这 3 个条件同时满足时，才把舆情层并入正式周报：

- 主题识别准确率足够高
- 与 policy / DA 事件存在可解释关系
- 不会显著增加人工清理成本

在此之前，舆情层只用于内部研究和实验图表。
