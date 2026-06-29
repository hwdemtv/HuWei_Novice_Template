---
tier: 2
lesson: L25
title: "让笔记变成动态数据库"
status: 未开始
created: 2026-06-24
estimated_time: "约 30 分钟"
tags:
  - 课程/炼器
---

# L25 | 让笔记变成动态数据库

> [!tip] 💡 你将收获
> - 理解 Dataview 是什么、为什么是进阶玩家的杀手锏
> - 写出 3 个最常用的查询：`TABLE` / `LIST` / `TASK`
> - 用 `WHERE` 筛选、`SORT` 排序，做出你自己的动态仪表盘

---

## 👀 看：仪表盘是怎么自动生成的

打开 [[首页]] 或 [[课程进度追踪]]，你会看到一些**自动生成的表格**——列着课号、标题、状态。

这些表格不是手写的，是 **Dataview** 插件**实时查出来**的。笔记一改，表格自动更新。

再看看你的火种——如果你能有一句话：

> 「显示我所有还没加工的火种，按日期从新到旧排。」

Dataview 就能帮你做到。这就是「把笔记当数据库用」。

![[L25-01-infographic-notes-to-database.png]]

> [!note] 💡 课程注释
> L01 把 Dataview 列为必装插件，但前面 20 课都没细讲。因为你**不需要懂它也能用这套系统**——首页和进度追踪的查询是现成的。但当你想自己做仪表盘、自动汇总时，Dataview 是那把钥匙。它是新手到高手的分水岭之一。

---

## 🧠 解：Dataview 的三个核心概念

### 1. Dataview 不写代码，写「查询」

你在笔记里插入一个代码块，告诉它「我要什么样的笔记」，它就把结果填进去：

````markdown
```dataview
LIST
FROM "10_一心 (随手丢·Inbox)"
```
````

保存后，这段会自动变成「Inbox 里所有笔记的列表」。

### 2. 四种查询类型

| 类型 | 长什么样 | 什么时候用 |
|------|---------|-----------|
| `LIST` | 一个列表（带标题） | 想要一个简单的清单 |
| `TABLE` | 一个表格（带多列） | 想显示笔记的多个属性 |
| `TASK` | 待办事项列表 | 想汇总所有 `- [ ]` 任务 |
| `CALENDAR` | 日历热力图 | 想看某日期字段的分布节奏（如阅读/写作打卡） |

### 3. 四个关键语句：`FROM` / `WHERE` / `SORT` / `GROUP BY`

- `FROM "文件夹"` 或 `FROM #标签` —— **从哪里找**（圈定范围）
- `WHERE 条件` —— **满足什么**（精确筛选）
- `SORT 字段 DESC` —— **怎么排**（DESC 倒序，新在上）
- `GROUP BY 字段` —— **怎么分组**（把结果按某字段归类，如把待办按来源笔记归并）

筛选条件用的是笔记的 **frontmatter 字段**（L03 学过的「身份证」）。比如你的火种有 `status: 火种`，就能 `WHERE status = "火种"`。

> [!example] 📋 查询语法速查表（写不出查询时翻这里）
> **FROM 数据来源（六种写法）**：
>
> | 写法 | 含义 |
> |------|------|
> | `FROM "文件夹"` | 扫描该文件夹及子文件夹 |
> | `FROM #标签` | 扫描打了该标签的笔记 |
> | `FROM [[笔记名]]` | 扫描链接到该笔记的所有笔记 |
> | `FROM ""` | 扫描整个仓库 |
> | `FROM -"文件夹"` | **排除**某文件夹（常用 `-00_万法` 排除模板区） |
> | `FROM "A" OR "B"` | 多来源合并 |
>
> **WHERE 运算符**：
>
> | 运算符 | 含义 | 示例 |
> |--------|------|------|
> | `=` / `!=` | 等于 / 不等于 | `WHERE status = "已完成"` |
> | `>` `<` `>=` `<=` | 大小比较 | `WHERE rating > 3` |
> | `AND` / `OR` | 逻辑与 / 或 | `WHERE rating > 3 AND pages < 300` |
> | `contains(字段, 值)` | 包含某值 | `WHERE contains(file.tags, "#推荐")` |
>
> 💡 这两张表覆盖 80% 的日常查询需求。

---

## 🔨 做：写出你的 3 个查询

### 查询 1｜LIST：列出所有火种

在任意笔记（建议放首页或新建一条「我的仪表盘」）里插入：

````markdown
```dataview
LIST
FROM #火种
SORT file.ctime DESC
```
````

- `FROM #火种` —— 所有打了 #火种 标签的笔记
- `file.ctime DESC` —— 按创建时间倒序（最新在上）

保存后看看，是不是列出了你的火种？

> [!warning] 标签 ≠ frontmatter 字段
> `FROM #火种` 查的是笔记正文中的**标签** `#火种`，和 frontmatter 里的 `status: 火种` 是两回事。如果你的火种笔记用的是 frontmatter 而不是标签，查询要改成：

> ```dataview
> LIST
> FROM "文件夹名"
> WHERE status = "火种"
> SORT file.ctime DESC
> ```

### 查询 2｜TABLE：列出 Lab 里的加工中笔记

````markdown
```dataview
TABLE status AS "状态", file.mtime AS "最后修改"
FROM "20_二旋 (磨一磨·Lab)"
WHERE status != null
SORT file.mtime DESC
```
````

- `TABLE status AS "状态"` —— 把 status 字段显示成一列，列名叫「状态」
- `WHERE status != null` —— 只要有 status 字段的（过滤掉没有属性的）
- `file.mtime` —— 文件最后修改时间

**这一招帮你盯着 Lab 里的草稿——哪些躺太久没动了，一目了然。**

### 查询 3｜TASK：汇总所有待办

````markdown
```dataview
TASK
WHERE !completed
GROUP BY file.link
```
````

- `WHERE !completed` —— 所有没打勾的待办
- `GROUP BY file.link` —— 按来源笔记分组

**这是「全局待办清单」——把散落在各笔记里的 `- [ ]` 全捞出来。**

> [!check] ✅ 验证清单
> - [ ] 写出并成功显示了一个 `LIST` 查询
> - [ ] 写出并成功显示了一个 `TABLE` 查询
> - [ ] 写出并成功显示了一个 `TASK` 查询
> - [ ] 理解 `FROM`、`WHERE`、`SORT` 各自的作用
> - [ ] 知道查询用的是 frontmatter 字段

---

## 🎯 变：进阶玩法（先知道有这些，不用马上学）

| 玩法 | 效果 | 用法提示 |
|------|------|---------|
| **内联查询** | 在一句话里插入一个动态值 | `` `= this.status` `` 显示当前笔记的 status |
| **DataviewJS** | 用 JS 写更复杂的查询 | 高阶玩家专属，可先跳过 |
| **按标签聚合** | 把所有 `#复盘` 笔记做成经验库 | `FROM #复盘` |
| **过期预警** | 找出 30 天没改过的草稿 | `WHERE file.mtime < date(today) - dur(30 days)` |

### 实战：搭一个「年度读书看板」

这是 Dataview 最过瘾的用法——把散落的读书笔记自动汇总成一个多维度看板。**前提：每篇读书笔记的 frontmatter 字段必须统一**（属性设计决定了查询的天花板）。

**第 0 步｜统一读书笔记属性**（你的读书笔记模板）：

```yaml
---
type: 读书笔记
author: 作者名
category: 心理学/技术/文学
rating: 4
pages: 350
status: 已完成   # 已完成 / 进行中 / 待阅读
started: 2026-01-15
finished: 2026-02-20
---
```

字段统一后，下面 4 个查询各管一块，拼成一个完整看板：

**① 年度统计**（总数 / 平均页数 / 平均评分）：

````markdown
```dataview
TABLE length(rows) AS "读书总数", round(sum(rows.pages)/length(rows)) AS "平均页数", round(sum(rows.rating)/length(rows), 1) AS "平均评分"
FROM "读书笔记"
WHERE status = "已完成" AND finished >= date("2026-01-01")
```
````

**② 高分书单**（评分 ≥ 4，按评分排序）：

````markdown
```dataview
TABLE author AS "作者", rating AS "评分", finished AS "完成日期"
FROM "读书笔记"
WHERE rating >= 4 AND status = "已完成"
SORT rating DESC
```
````

**③ 按类别统计**（用 `GROUP BY` 分组）：

````markdown
```dataview
TABLE length(rows) AS "数量", round(avg(rows.rating), 1) AS "均分"
FROM "读书笔记"
WHERE status = "已完成"
GROUP BY category
SORT length(rows) DESC
```
````

**④ 阅读日历**（用 `CALENDAR`，热力图看阅读节奏）：

````markdown
```dataview
CALENDAR finished
FROM "读书笔记"
WHERE status = "已完成"
```
````

> [!tip] 💡 举一反三
> 把"读书"换成"项目""课程""健身记录"——同一套结构能汇总**任何有统一属性的内容**。钥匙永远是先统一 frontmatter。

> [!example] 🧮 常用函数速查
> `length(rows)` 数量 · `sum(rows.字段)` 求和 · `avg(rows.字段)` 均值 · `round(值, 小数位)` 四舍五入 · `date("2026-01-01")` 日期 · `dur(30 days)` 时间段 · `contains(字段, 值)` 包含。
> 用了 `GROUP BY` 后，组内数据要用 `rows.字段` 访问（如 `rows.pages`）。

> [!info]- 深入（可选）：`FLATTEN` 与 `DataviewJS`
> - **`FLATTEN`**：把列表字段"摊平"成多行。一篇笔记若有多个作者 `authors: [A, B]`，`FLATTEN authors` 会拆成两行各算一次，适合统计嵌套列表。
> - **`DataviewJS`**：用 `` ```dataviewjs `` 代码块写 JavaScript，能做查询语言做不到的复杂逻辑（循环、条件渲染）。高阶玩家专属，需要时再查[官方文档](https://blacksmithgu.github.io/obsidian-dataview/)。

> [!warning] ⚠️ 常见报错
> - **查询不显示内容**：检查 `FROM` 的文件夹名/标签名是否完全一致（含中文和括号）
> - **表格列是空的**：检查 frontmatter 字段名拼写，`status` 不是 `Status`（区分大小写）
> - **插件没生效**：设置 → 第三方插件 → 确认 Dataview 已启用

> [!tip] 心法
> Dataview 的本质是：**你给笔记贴的标签和属性（frontmatter），都是未来查询的钩子**。所以前面 L03 让你认真填 frontmatter、L04 让你埋关键词——它们在这里兑现成「自动化的力量」。

> [!tip] 延伸阅读
> - [[首页]] — 看现成的 Dataview 查询长什么样
> - [[课程进度追踪]] — 另一个 Dataview 仪表盘范例
> - [Dataview 官方文档](https://blacksmithgu.github.io/obsidian-dataview/) — 所有查询语法（英文，需要时查）

> 📎 本课的查询语法速查表与「年度读书看板」实战，部分参考自 SerpentSource《Obsidian 知识管理大师课 3.0》第 12 章。

---

> [!success] 🎉 里程碑：Tier 2 炼器完成！
> 你集齐了让经验复利的全套兵器：
> - ✅ 费曼学习卡（L20）—— 学进去
> - ✅ 复盘规则（L21）—— 沉淀下来
> - ✅ 内容引擎（L22）—— 持续产出
> - ✅ AI 对手盘（L23）—— 思维磨刀石
> - ✅ 知识地图（L24）—— 连成网络
> - ✅ Dataview（L25）—— 系统可视化、自动化
>
> **你的笔记现在是活的：能查、能连、能自动汇总。** 最后一阶段（Tier 3 归藏），我们把单篇升级成系列，把模板变成可分发的资产。

---

## ➡️ 下一课预告

Tier 2 全部点亮。下一课进入最后的 **Tier 3 归藏**——来学**系列路线图**。把单篇文章升级成 8 篇系列，用一个等级系统（Lv.0-8）规划你的长线内容。

→ [[00_万法 (开箱即用·Hub)/06_课程/_课程-L30-系列路线图|L30：从单篇到系列——8 篇路线图]]
