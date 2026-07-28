---
title: Dashboard
cssclasses:
  - dashboard
tags:
  - dashboard
---

# 🎯 调度台

> 今天做什么，一眼就清楚。数据由 Dataview 自动读取，无需手动维护数字。

```dataviewjs
// 01 · 调度台统计卡
const folders = {
  inbox: "10_一心 (随手丢·Inbox)",
  lab: "20_二旋 (磨一磨·Lab)",
  output: "30_三进阶 (出锅了·Output)",
  archive: "40_四归藏 (存起来·Archive)"
};
const today = dv.date("today").startOf("day");
const weekStart = today.startOf("week");
// 业务口径：只看四个工作流目录；看板、清单和索引不算作知识笔记。
const excludedNames = new Set(["_今日待处理", "发布清单", "📚我的书架", "📚知识书架"]);
const pagesIn = folder => dv.pages(`"${folder}"`).array()
  .filter(p => !p.file.name.startsWith("_") && !excludedNames.has(p.file.name));
const workFiles = Object.values(folders).flatMap(pagesIn);
// 无效日期不应中断整页；它会作为缺失日期进入完整度提示。
const parseDate = raw => {
  if (!raw) return null;
  if (typeof raw.startOf === "function" && typeof raw.toMillis === "function") return raw;
  const parsed = dv.date(raw);
  return parsed?.isValid === false ? null : parsed ?? null;
};
const createdDate = p => parseDate(p.created)?.startOf("day") ?? null;
const publishedDate = p => parseDate(p.published_date)?.startOf("day") ?? null;
const stageOf = p => {
  const status = String(p.status ?? p.状态 ?? p.stage ?? "");
  if (/归档|archive/i.test(status) || p.file.path.startsWith(folders.archive)) return "archived";
  if (/完成|发布|done/i.test(status) || p.file.path.startsWith(folders.output)) return "done";
  if (/进行|加工|doing|lab/i.test(status) || p.file.path.startsWith(folders.lab)) return "doing";
  return "idea";
};
const stageRank = { idea: 1, doing: 2, done: 3, archived: 4 };
// 只有显式 asset_id 才允许跨阶段合并，避免同名但不同主题的笔记被误计为同一资产。
const assetKey = p => String(p.asset_id ?? p.file.path);
const assetGroups = new Map();
workFiles.forEach(p => {
  const key = assetKey(p);
  assetGroups.set(key, [...(assetGroups.get(key) ?? []), p]);
});
const assets = [...assetGroups.entries()].map(([key, records]) => {
  const current = [...records].sort((a, b) => stageRank[stageOf(b)] - stageRank[stageOf(a)])[0];
  const created = records.map(createdDate).filter(Boolean).sort((a, b) => a.toMillis() - b.toMillis())[0] ?? null;
  const publishedRecord = records.filter(p => publishedDate(p))
    .sort((a, b) => publishedDate(b).toMillis() - publishedDate(a).toMillis())[0] ?? null;
  return { key, records, current, stage: stageOf(current), created, published: publishedRecord ? publishedDate(publishedRecord) : null, publishedRecord };
});
const createdToday = assets.filter(a => a.created?.equals(today)).length;
const activeTaskPages = [...pagesIn(folders.inbox), ...pagesIn(folders.lab)]
  .filter(p => !p.file.name.includes("示例"));
// 待办只来自收集箱和加工区；已发布/归档笔记内的检查清单不视为待办。
const priorityRank = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };
const dueMillis = t => parseDate(t.due)?.toMillis() ?? Number.POSITIVE_INFINITY;
const openTasks = activeTaskPages.flatMap(p => Array.from(p.file.tasks ?? [])
  .filter(t => !t.completed).map(t => ({ task: t, modified: p.file.mtime })))
  .sort((a, b) => dueMillis(a.task) - dueMillis(b.task)
    || (priorityRank[String(a.task.priority ?? "").toLowerCase()] ?? 9) - (priorityRank[String(b.task.priority ?? "").toLowerCase()] ?? 9)
    || b.modified.toMillis() - a.modified.toMillis());
// 发布指标只接受明确填写的 published_date，绝不回退到 created。
const weeklyOutput = assets.filter(a => a.published && a.published >= weekStart && a.published <= today).length;
const undatedAssets = assets.filter(a => !a.created);
const unpublishedOutputs = pagesIn(folders.output).filter(p => !publishedDate(p));

const root = dv.container;
root.classList.add("dashboard-shell");
const el = (parent, tag, cls, text) => parent.createEl(tag, { cls, text });
const link = (parent, path, text) => {
  // 阅读视图：MarkdownRenderer.render 渲染的链接自带原生点击处理，无需干预。
  // 编辑视图(CM6 Live Preview)：CM6 会拦截 click 事件，改用 pointerdown（先于 click 触发）绕过拦截。
  const holder = parent.createEl("span");
  const md = `[[${path}|${text}]]`;
  const sourcePath = dv.current()?.file?.path ?? "";
  const cleanPath = path.replace(/\.md$/, "");
  const bindOpen = (el, href) => {
    el.style.cursor = "pointer";
    el.addEventListener("pointerdown", (evt) => {
      if (evt.button !== 0) return;
      evt.preventDefault();
      evt.stopPropagation();
      dv.app.workspace.openLinkText(href, sourcePath, evt.ctrlKey || evt.metaKey);
    });
  };
  let rendered = false;
  try {
    const { MarkdownRenderer } = require("obsidian");
    if (typeof MarkdownRenderer.render === "function") {
      MarkdownRenderer.render(dv.app, md, holder, sourcePath, dv.component);
    } else {
      MarkdownRenderer.renderMarkdown(md, holder, sourcePath, dv.component);
    }
    rendered = holder.querySelectorAll("a").length > 0;
    // 仅 CM6 编辑视图需要补绑 pointerdown；阅读视图原生链接已可点击
    if (rendered && dv.container.closest(".cm-editor")) {
      holder.querySelectorAll("a").forEach(a => {
        const href = (a.getAttr("data-href") || a.getAttr("href") || "").replace(/\.md$/, "");
        if (href) bindOpen(a, href);
      });
    }
  } catch (e) {
    console.error("[dash-link] MarkdownRenderer failed, manual fallback", e);
  }
  if (!rendered) {
    const a = holder.createEl("a", { cls: "internal-link", text });
    a.setAttr("data-href", cleanPath);
    a.setAttr("href", cleanPath);
    bindOpen(a, cleanPath);
  }
  return holder;
};
const section = (cls, icon, title, subtitle = "") => {
  const box = el(root, "section", `dashboard-panel ${cls}`);
  const head = el(box, "div", "panel-heading");
  el(head, "h2", "panel-title", `${icon} ${title}`);
  if (subtitle) el(head, "span", "panel-subtitle", subtitle);
  return box;
};

const overview = section("overview-panel", "🎯", "调度台", "今天做什么，一眼就清楚");
const statGrid = el(overview, "div", "stat-grid");
[
  ["今日记录", createdToday, "按资产 created 日期"],
  ["待处理任务", openTasks.length, "Inbox + Lab"],
  ["本周输出", weeklyOutput + " 篇", "按 published_date"],
  ["知识资产", assets.length, "跨阶段副本已去重"]
].forEach(([label, value, hint]) => {
  const card = el(statGrid, "div", "stat-card");
  el(card, "span", "stat-label", label);
  el(card, "strong", "stat-number", String(value));
  el(card, "span", "stat-hint", hint);
});

const taskList = el(overview, "div", "task-preview");
el(taskList, "h3", "mini-heading", "下一步");
if (openTasks.length === 0) {
  el(taskList, "p", "empty-state", "🎉 没有待处理任务。");
} else {
  const ul = el(taskList, "ul", "task-list");
  openTasks.slice(0, 4).forEach(({ task: t }) => {
    const item = el(ul, "li", "task-item");
    link(item, t.path, t.text.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1"));
  });
}
const quality = el(overview, "p", "data-quality", `数据完整度：${undatedAssets.length} 个资产缺少 created；${unpublishedOutputs.length} 篇输出缺少 published_date。`);
```

```dataviewjs
// 02 · 近 17 周热力图（按业务日期，而非文件导入时间计算）
const folders = {
  inbox: "10_一心 (随手丢·Inbox)",
  lab: "20_二旋 (磨一磨·Lab)",
  output: "30_三进阶 (出锅了·Output)",
  archive: "40_四归藏 (存起来·Archive)"
};
const today = dv.date("today").startOf("day");
const excludedNames = new Set(["_今日待处理", "发布清单", "📚我的书架", "📚知识书架"]);
const pagesIn = folder => dv.pages(`"${folder}"`).array()
  .filter(p => !p.file.name.startsWith("_") && !excludedNames.has(p.file.name));
const workFiles = Object.values(folders).flatMap(pagesIn);
const parseDate = raw => {
  if (!raw) return null;
  if (typeof raw.startOf === "function" && typeof raw.toMillis === "function") return raw;
  const parsed = dv.date(raw);
  return parsed?.isValid === false ? null : parsed ?? null;
};
const createdDate = p => parseDate(p.created)?.startOf("day") ?? null;
const publishedDate = p => parseDate(p.published_date)?.startOf("day") ?? null;
const stageOf = p => {
  const status = String(p.status ?? p.状态 ?? p.stage ?? "");
  if (/归档|archive/i.test(status) || p.file.path.startsWith(folders.archive)) return "archived";
  if (/完成|发布|done/i.test(status) || p.file.path.startsWith(folders.output)) return "done";
  if (/进行|加工|doing|lab/i.test(status) || p.file.path.startsWith(folders.lab)) return "doing";
  return "idea";
};
const stageRank = { idea: 1, doing: 2, done: 3, archived: 4 };
const assetKey = p => String(p.asset_id ?? p.file.path);
const assetGroups = new Map();
workFiles.forEach(p => {
  const key = assetKey(p);
  assetGroups.set(key, [...(assetGroups.get(key) ?? []), p]);
});
const assets = [...assetGroups.entries()].map(([key, records]) => {
  const current = [...records].sort((a, b) => stageRank[stageOf(b)] - stageRank[stageOf(a)])[0];
  const created = records.map(createdDate).filter(Boolean).sort((a, b) => a.toMillis() - b.toMillis())[0] ?? null;
  const publishedRecord = records.filter(p => publishedDate(p))
    .sort((a, b) => publishedDate(b).toMillis() - publishedDate(a).toMillis())[0] ?? null;
  return { key, records, current, stage: stageOf(current), created, published: publishedRecord ? publishedDate(publishedRecord) : null, publishedRecord };
});

const root = dv.container;
root.classList.add("dashboard-shell");
const el = (parent, tag, cls, text) => parent.createEl(tag, { cls, text });
const section = (cls, icon, title, subtitle = "") => {
  const box = el(root, "section", `dashboard-panel ${cls}`);
  const head = el(box, "div", "panel-heading");
  el(head, "h2", "panel-title", `${icon} ${title}`);
  if (subtitle) el(head, "span", "panel-subtitle", subtitle);
  return box;
};

const heatmap = section("heatmap-panel", "🔥", "热力图", "按真实记录/发布日期统计");
const tracked = assets;
const counts = {};
tracked.forEach(a => {
  const d = a.created;
  if (d) {
    const key = d.toFormat("yyyy-LL-dd");
    counts[key] = (counts[key] || 0) + 1;
  }
});
const start = today.minus({ days: 118 }).startOf("week");
const monthRow = el(heatmap, "div", "heatmap-months");
for (let week = 0; week < 17; week++) {
  const d = start.plus({ days: week * 7 });
  el(monthRow, "span", "heatmap-month", d.day <= 7 ? `${d.month}月` : "");
}
const heatBody = el(heatmap, "div", "heatmap-body");
const weekday = ["一", "二", "三", "四", "五", "六", "日"];
for (let day = 0; day < 7; day++) {
  const row = el(heatBody, "div", "heatmap-row");
  el(row, "span", "weekday", weekday[day]);
  for (let week = 0; week < 17; week++) {
    const d = start.plus({ days: week * 7 + day });
    const count = counts[d.toFormat("yyyy-LL-dd")] || 0;
    const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 4 ? 2 : 3;
    const cell = el(row, "span", `heat-cell level-${level}${d > today ? " future" : ""}`);
    cell.setAttr("aria-label", `${d.toFormat("yyyy-LL-dd")}：${count} 篇`);
  }
}
const legend = el(heatmap, "div", "heatmap-legend");
el(legend, "span", "legend-label", "少");
[0, 1, 2, 3].forEach(i => el(legend, "span", `heat-cell level-${i}`));
el(legend, "span", "legend-label", "多");
```

```dataviewjs
// 03 · 日—周—月节奏：快捷进入记录与复盘，汇总当前时间尺度的真实进展。
const folders = {
  inbox: "10_一心 (随手丢·Inbox)",
  lab: "20_二旋 (磨一磨·Lab)",
  output: "30_三进阶 (出锅了·Output)",
  archive: "40_四归藏 (存起来·Archive)"
};
const today = dv.date("today").startOf("day");
const weekStart = today.startOf("week");
const monthStart = today.startOf("month");
const excludedNames = new Set(["_今日待处理", "发布清单", "📚我的书架", "📚知识书架"]);
const pagesIn = folder => dv.pages(`"${folder}"`).array()
  .filter(p => !p.file.name.startsWith("_") && !excludedNames.has(p.file.name));
const workFiles = Object.values(folders).flatMap(pagesIn);
const parseDate = raw => {
  if (!raw) return null;
  if (typeof raw.startOf === "function" && typeof raw.toMillis === "function") return raw;
  const parsed = dv.date(raw);
  return parsed?.isValid === false ? null : parsed ?? null;
};
const createdDate = p => parseDate(p.created)?.startOf("day") ?? null;
const publishedDate = p => parseDate(p.published_date)?.startOf("day") ?? null;
const stageOf = p => {
  const status = String(p.status ?? p.状态 ?? p.stage ?? "");
  if (/归档|archive/i.test(status) || p.file.path.startsWith(folders.archive)) return "archived";
  if (/完成|发布|done/i.test(status) || p.file.path.startsWith(folders.output)) return "done";
  if (/进行|加工|doing|lab/i.test(status) || p.file.path.startsWith(folders.lab)) return "doing";
  return "idea";
};
const stageRank = { idea: 1, doing: 2, done: 3, archived: 4 };
const assetKey = p => String(p.asset_id ?? p.file.path);
const assetGroups = new Map();
workFiles.forEach(p => {
  const key = assetKey(p);
  assetGroups.set(key, [...(assetGroups.get(key) ?? []), p]);
});
const assets = [...assetGroups.entries()].map(([key, records]) => {
  const current = [...records].sort((a, b) => stageRank[stageOf(b)] - stageRank[stageOf(a)])[0];
  const created = records.map(createdDate).filter(Boolean).sort((a, b) => a.toMillis() - b.toMillis())[0] ?? null;
  const publishedRecord = records.filter(p => publishedDate(p))
    .sort((a, b) => publishedDate(b).toMillis() - publishedDate(a).toMillis())[0] ?? null;
  return { key, records, current, stage: stageOf(current), created, published: publishedRecord ? publishedDate(publishedRecord) : null, publishedRecord };
});
const createdToday = assets.filter(a => a.created?.equals(today)).length;
const activeTaskPages = [...pagesIn(folders.inbox), ...pagesIn(folders.lab)]
  .filter(p => !p.file.name.includes("示例"));
const priorityRank = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };
const dueMillis = t => parseDate(t.due)?.toMillis() ?? Number.POSITIVE_INFINITY;
const openTasks = activeTaskPages.flatMap(p => Array.from(p.file.tasks ?? [])
  .filter(t => !t.completed).map(t => ({ task: t, modified: p.file.mtime })))
  .sort((a, b) => dueMillis(a.task) - dueMillis(b.task)
    || (priorityRank[String(a.task.priority ?? "").toLowerCase()] ?? 9) - (priorityRank[String(b.task.priority ?? "").toLowerCase()] ?? 9)
    || b.modified.toMillis() - a.modified.toMillis());
const weeklyOutput = assets.filter(a => a.published && a.published >= weekStart && a.published <= today).length;
const monthlyCreated = assets.filter(a => a.created && a.created >= monthStart && a.created <= today).length;
const monthlyPublished = assets.filter(a => a.published && a.published >= monthStart && a.published <= today).length;

const root = dv.container;
root.classList.add("dashboard-shell");
const el = (parent, tag, cls, text) => parent.createEl(tag, { cls, text });
const link = (parent, path, text) => {
  const holder = parent.createEl("span");
  const md = `[[${path}|${text}]]`;
  const sourcePath = dv.current()?.file?.path ?? "";
  const cleanPath = path.replace(/\.md$/, "");
  const bindOpen = (el, href) => {
    el.style.cursor = "pointer";
    el.addEventListener("pointerdown", (evt) => {
      if (evt.button !== 0) return;
      evt.preventDefault();
      evt.stopPropagation();
      dv.app.workspace.openLinkText(href, sourcePath, evt.ctrlKey || evt.metaKey);
    });
  };
  let rendered = false;
  try {
    const { MarkdownRenderer } = require("obsidian");
    if (typeof MarkdownRenderer.render === "function") {
      MarkdownRenderer.render(dv.app, md, holder, sourcePath, dv.component);
    } else {
      MarkdownRenderer.renderMarkdown(md, holder, sourcePath, dv.component);
    }
    rendered = holder.querySelectorAll("a").length > 0;
    if (rendered && dv.container.closest(".cm-editor")) {
      holder.querySelectorAll("a").forEach(a => {
        const href = (a.getAttr("data-href") || a.getAttr("href") || "").replace(/\.md$/, "");
        if (href) bindOpen(a, href);
      });
    }
  } catch (e) {
    console.error("[dash-link] MarkdownRenderer failed, manual fallback", e);
  }
  if (!rendered) {
    const a = holder.createEl("a", { cls: "internal-link", text });
    a.setAttr("data-href", cleanPath);
    a.setAttr("href", cleanPath);
    bindOpen(a, cleanPath);
  }
  return holder;
};
const section = (cls, icon, title, subtitle = "") => {
  const box = el(root, "section", `dashboard-panel ${cls}`);
  const head = el(box, "div", "panel-heading");
  el(head, "h2", "panel-title", `${icon} ${title}`);
  if (subtitle) el(head, "span", "panel-subtitle", subtitle);
  return box;
};

const rhythm = section("rhythm-panel", "🗓️", "时间节奏", "记录、推进、复盘");
const rhythmSummary = el(rhythm, "div", "rhythm-summary");
[
  ["今日", `${createdToday} 条记录`, `${openTasks.length} 项待办`],
  ["本周", `${weeklyOutput} 篇发布`, "完成周度回顾"],
  ["本月", `${monthlyCreated} 项新增资产`, `${monthlyPublished} 篇发布`]
].forEach(([period, value, hint]) => {
  const item = el(rhythmSummary, "div", "rhythm-stat");
  el(item, "span", "rhythm-period", period);
  el(item, "strong", "rhythm-value", value);
  el(item, "span", "rhythm-hint", hint);
});
const rhythmActions = el(rhythm, "div", "rhythm-actions");
[
  ["☀️ 今日调度", "查看待办与当前推进事项", "10_一心 (随手丢·Inbox)/_今日待处理", "打开调度台 →"],
  ["📝 每日记录", "打开每日笔记模板，开始当天记录", "00_万法 (开箱即用·Hub)/01_模板/05_生活应用/模板-每日笔记", "打开每日模板 →"],
  ["🔄 周度回顾", "打开周度回顾模板，整理下周重点", "00_万法 (开箱即用·Hub)/01_模板/06_外部模板库/01 - 日志/周度回顾", "打开周回顾模板 →"],
  ["🎯 月度规划", "打开月度目标模板，设定目标与复盘", "00_万法 (开箱即用·Hub)/01_模板/06_外部模板库/01 - 日志/月度目标", "打开月度模板 →"]
].forEach(([title, desc, path, label]) => {
  const card = el(rhythmActions, "article", "rhythm-action");
  el(card, "h3", "rhythm-action-title", title);
  el(card, "p", "rhythm-action-desc", desc);
  link(card, path, label);
});
```

```dataviewjs
// 04 · 我的书架：与「📚我的书架」使用完全相同的数据口径。
const parseDate = raw => {
  if (!raw) return null;
  if (typeof raw.startOf === "function" && typeof raw.toMillis === "function") return raw;
  const parsed = dv.date(raw);
  return parsed?.isValid === false ? null : parsed ?? null;
};

const root = dv.container;
root.classList.add("dashboard-shell");
const el = (parent, tag, cls, text) => parent.createEl(tag, { cls, text });
const link = (parent, path, text) => {
  const holder = parent.createEl("span");
  const md = `[[${path}|${text}]]`;
  const sourcePath = dv.current()?.file?.path ?? "";
  const cleanPath = path.replace(/\.md$/, "");
  const bindOpen = (el, href) => {
    el.style.cursor = "pointer";
    el.addEventListener("pointerdown", (evt) => {
      if (evt.button !== 0) return;
      evt.preventDefault();
      evt.stopPropagation();
      dv.app.workspace.openLinkText(href, sourcePath, evt.ctrlKey || evt.metaKey);
    });
  };
  let rendered = false;
  try {
    const { MarkdownRenderer } = require("obsidian");
    if (typeof MarkdownRenderer.render === "function") {
      MarkdownRenderer.render(dv.app, md, holder, sourcePath, dv.component);
    } else {
      MarkdownRenderer.renderMarkdown(md, holder, sourcePath, dv.component);
    }
    rendered = holder.querySelectorAll("a").length > 0;
    if (rendered && dv.container.closest(".cm-editor")) {
      holder.querySelectorAll("a").forEach(a => {
        const href = (a.getAttr("data-href") || a.getAttr("href") || "").replace(/\.md$/, "");
        if (href) bindOpen(a, href);
      });
    }
  } catch (e) {
    console.error("[dash-link] MarkdownRenderer failed, manual fallback", e);
  }
  if (!rendered) {
    const a = holder.createEl("a", { cls: "internal-link", text });
    a.setAttr("data-href", cleanPath);
    a.setAttr("href", cleanPath);
    bindOpen(a, cleanPath);
  }
  return holder;
};
const section = (cls, icon, title, subtitle = "") => {
  const box = el(root, "section", `dashboard-panel ${cls}`);
  const head = el(box, "div", "panel-heading");
  el(head, "h2", "panel-title", `${icon} ${title}`);
  if (subtitle) el(head, "span", "panel-subtitle", subtitle);
  return box;
};

const bookshelfPath = "30_三进阶 (出锅了·Output)/📚我的书架";
const shelf = section("shelf-panel", "📚", "我的书架", "在读、已读与待读书目");
const shelfEntry = el(shelf, "p", "shelf-entry");
link(shelfEntry, bookshelfPath, "打开完整书架 →");
const shelfGrid = el(shelf, "div", "shelf-grid");
const books = dv.pages("#读书").where(p => p.type === "读书笔记").array()
  .filter(p => !p.file.path.includes("/01_模板/"));
const bookDate = p => parseDate(p.finished) ?? parseDate(p.started);
const shelfBooks = [...books]
  .sort((a, b) => (bookDate(b)?.toMillis() ?? 0) - (bookDate(a)?.toMillis() ?? 0))
  .slice(0, 4);
shelfBooks.forEach((p, index) => {
  const card = el(shelfGrid, "article", `book-card book-tone-${index % 4}`);
  el(card, "span", "book-type", `${p.status || "未标注状态"} · ${p.author || "未填写作者"}`);
  link(card, p.file.path, p.file.name);
  el(card, "time", "book-date", bookDate(p)?.toFormat("yyyy-LL-dd") ?? "未填写阅读日期");
});
```

```dataviewjs
// 05 · 项目看板：status 可覆盖默认状态；否则以工作流所在目录作为真实阶段。
const folders = {
  inbox: "10_一心 (随手丢·Inbox)",
  lab: "20_二旋 (磨一磨·Lab)",
  output: "30_三进阶 (出锅了·Output)",
  archive: "40_四归藏 (存起来·Archive)"
};
const excludedNames = new Set(["_今日待处理", "发布清单", "📚我的书架", "📚知识书架"]);
const pagesIn = folder => dv.pages(`"${folder}"`).array()
  .filter(p => !p.file.name.startsWith("_") && !excludedNames.has(p.file.name));
const workFiles = Object.values(folders).flatMap(pagesIn);
const parseDate = raw => {
  if (!raw) return null;
  if (typeof raw.startOf === "function" && typeof raw.toMillis === "function") return raw;
  const parsed = dv.date(raw);
  return parsed?.isValid === false ? null : parsed ?? null;
};
const createdDate = p => parseDate(p.created)?.startOf("day") ?? null;
const publishedDate = p => parseDate(p.published_date)?.startOf("day") ?? null;
const stageOf = p => {
  const status = String(p.status ?? p.状态 ?? p.stage ?? "");
  if (/归档|archive/i.test(status) || p.file.path.startsWith(folders.archive)) return "archived";
  if (/完成|发布|done/i.test(status) || p.file.path.startsWith(folders.output)) return "done";
  if (/进行|加工|doing|lab/i.test(status) || p.file.path.startsWith(folders.lab)) return "doing";
  return "idea";
};
const stageRank = { idea: 1, doing: 2, done: 3, archived: 4 };
const assetKey = p => String(p.asset_id ?? p.file.path);
const assetGroups = new Map();
workFiles.forEach(p => {
  const key = assetKey(p);
  assetGroups.set(key, [...(assetGroups.get(key) ?? []), p]);
});
const assets = [...assetGroups.entries()].map(([key, records]) => {
  const current = [...records].sort((a, b) => stageRank[stageOf(b)] - stageRank[stageOf(a)])[0];
  const created = records.map(createdDate).filter(Boolean).sort((a, b) => a.toMillis() - b.toMillis())[0] ?? null;
  const publishedRecord = records.filter(p => publishedDate(p))
    .sort((a, b) => publishedDate(b).toMillis() - publishedDate(a).toMillis())[0] ?? null;
  return { key, records, current, stage: stageOf(current), created, published: publishedRecord ? publishedDate(publishedRecord) : null, publishedRecord };
});

const root = dv.container;
root.classList.add("dashboard-shell");
const el = (parent, tag, cls, text) => parent.createEl(tag, { cls, text });
const link = (parent, path, text) => {
  const holder = parent.createEl("span");
  const md = `[[${path}|${text}]]`;
  const sourcePath = dv.current()?.file?.path ?? "";
  const cleanPath = path.replace(/\.md$/, "");
  const bindOpen = (el, href) => {
    el.style.cursor = "pointer";
    el.addEventListener("pointerdown", (evt) => {
      if (evt.button !== 0) return;
      evt.preventDefault();
      evt.stopPropagation();
      dv.app.workspace.openLinkText(href, sourcePath, evt.ctrlKey || evt.metaKey);
    });
  };
  let rendered = false;
  try {
    const { MarkdownRenderer } = require("obsidian");
    if (typeof MarkdownRenderer.render === "function") {
      MarkdownRenderer.render(dv.app, md, holder, sourcePath, dv.component);
    } else {
      MarkdownRenderer.renderMarkdown(md, holder, sourcePath, dv.component);
    }
    rendered = holder.querySelectorAll("a").length > 0;
    if (rendered && dv.container.closest(".cm-editor")) {
      holder.querySelectorAll("a").forEach(a => {
        const href = (a.getAttr("data-href") || a.getAttr("href") || "").replace(/\.md$/, "");
        if (href) bindOpen(a, href);
      });
    }
  } catch (e) {
    console.error("[dash-link] MarkdownRenderer failed, manual fallback", e);
  }
  if (!rendered) {
    const a = holder.createEl("a", { cls: "internal-link", text });
    a.setAttr("data-href", cleanPath);
    a.setAttr("href", cleanPath);
    bindOpen(a, cleanPath);
  }
  return holder;
};
const dateText = d => d?.toFormat("yyyy-LL-dd") ?? "未填写业务日期";
const section = (cls, icon, title, subtitle = "") => {
  const box = el(root, "section", `dashboard-panel ${cls}`);
  const head = el(box, "div", "panel-heading");
  el(head, "h2", "panel-title", `${icon} ${title}`);
  if (subtitle) el(head, "span", "panel-subtitle", subtitle);
  return box;
};

const board = section("board-panel", "🗂️", "项目看板", "以工作流阶段为准");
const columns = [
  { key: "idea", title: "想法收集", folder: folders.inbox },
  { key: "doing", title: "进行中", folder: folders.lab },
  { key: "done", title: "已完成", folder: folders.output }
];
const classified = { idea: [], doing: [], done: [] };
assets.forEach(a => {
  const column = a.stage === "archived" ? "done" : a.stage;
  classified[column].push(a);
});
const boardGrid = el(board, "div", "board-grid");
columns.forEach(col => {
  const lane = el(boardGrid, "div", `board-column ${col.key}`);
  const items = classified[col.key]
    .sort((a, b) => (b.created?.toMillis() ?? 0) - (a.created?.toMillis() ?? 0))
    .slice(0, 5);
  const head = el(lane, "div", "board-column-head");
  el(head, "h3", "board-column-title", col.title);
  el(head, "span", "board-count", String(items.length));
  if (items.length === 0) el(lane, "p", "empty-state", "暂无笔记");
  items.forEach(a => {
    const card = el(lane, "article", "project-card");
    link(card, a.current.file.path, a.current.file.name);
    el(card, "span", "project-meta", `${a.current.status || a.current.状态 || "按目录归类"} · ${dateText(a.created)}`);
  });
});
```

> [!tip] 使用说明
> - 本页由 5 个**独立的 dataviewjs 代码块**组成（调度台 / 热力图 / 时间节奏 / 我的书架 / 项目看板），每块自包含配置与工具函数，可单独编辑、移动或删除。
> - 每个代码块都为自身容器加了 `dashboard-shell` 类，以继承颜色变量与居中宽度；因此每块面板现在**独占整行**（由原来的同容器多列并排，改为自上而下堆叠）。
> - 从 [[中控台.canvas|知识中控台]] 查看整体流转；从本页安排当天行动。
> - 统计仅按显式 `asset_id` 合并跨阶段副本；没有 `asset_id` 的笔记始终独立计数。每个资产的热力图只记录一次 `created`。
> - 书架与本周输出只统计明确填写 `published_date` 的输出；待办只统计 Inbox 与 Lab，并按截止日、优先级、最近修改时间排序。
> - 项目笔记可添加 `status: 想法收集 / 进行中 / 已完成`，即可覆盖按文件夹推断的默认状态。
> - 在「设置 → 外观 → CSS 代码片段」确认已启用 `dashboard`；本库已自动写入启用配置。
