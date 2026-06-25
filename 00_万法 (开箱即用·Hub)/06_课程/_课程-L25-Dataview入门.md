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

### 2. 三种查询类型

| 类型 | 长什么样 | 什么时候用 |
|------|---------|-----------|
| `LIST` | 一个列表（带标题） | 想要一个简单的清单 |
| `TABLE` | 一个表格（带多列） | 想显示笔记的多个属性 |
| `TASK` | 待办事项列表 | 想汇总所有 `- [ ]` 任务 |

### 3. 两个关键语句：`FROM` 和 `WHERE`

- `FROM "文件夹"` 或 `FROM #标签` —— **从哪里找**（圈定范围）
- `WHERE 条件` —— **满足什么**（精确筛选）
- `SORT 字段 DESC` —— **怎么排**（DESC 倒序，新在上）

筛选条件用的是笔记的 **frontmatter 字段**（L03 学过的「身份证」）。比如你的火种有 `status: 火种`，就能 `WHERE status = "火种"`。

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
