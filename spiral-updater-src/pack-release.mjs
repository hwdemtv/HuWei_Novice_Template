#!/usr/bin/env node
// ============================================================
// 📦 互为螺旋·知识操作系统 — 跨平台分发打包脚本 (Node.js)
// 适用: Windows / macOS / Linux （仅需 Node 18+）
// 用法: node pack-release.mjs [输出目录]    默认输出到 ../dist
//
// 设计要点:
//   • 零额外依赖 —— 复用 spiral-updater-src/node_modules/fflate 打 UTF-8 zip
//     (fflate.zipSync 文件名按 UTF-8 编码，Win/macOS/Linux 一致，杜绝中文乱码)
//   • 跨平台 —— 纯 Node fs/path，不依赖 robocopy/rsync/PowerShell
//   • 自动注入 spiral-updater 插件产物到 .obsidian/plugins/spiral-updater/
//   • 自动生成 _update-manifest.json（覆盖规则真相源）与 latest.json（含 sha256）
//   • 清理 API Key 等敏感配置
// ============================================================

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
// 复用插件工程已安装的 fflate，无需在仓库根再加依赖
const fflatePath = path.join("spiral-updater-src", "node_modules", "fflate");
const { zipSync, strToU8 } = require(fflatePath);

// ── 配置
const ROOT = process.cwd();
const VAULT_NAME = path.basename(ROOT);
const OUT_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "..", "dist");

const VERSION = (await fsp.readFile(path.join(ROOT, ".template-version"), "utf8")).trim();
if (!/^\d+\.\d+\.\d+/.test(VERSION)) {
  console.error(`❌ .template-version 内容无效: "${VERSION}"，应为 x.y.z`);
  process.exit(1);
}
const ZIP_NAME = `${VAULT_NAME}-v${VERSION}.zip`;
const RELEASED_AT = new Date().toISOString().slice(0, 10);
const RELEASE_REPO = "hwdemtv/HuWei_Novice_Template-releases";

// ── 排除规则
const EXCLUDE_TOP = new Set([
  ".git", ".trash", ".stfolder", ".codex", ".agents",
  "node_modules", "spiral-updater-src", ".更新备份", "dist",
]);
const EXCLUDE_ROOT_FILES = new Set([
  "README.md", ".gitignore", ".stignore",
  "pack-release.sh", "pack-release.mjs", "pack-release.legacy-win.sh",
  ".template-version",
]);
const EXCLUDE_FILE_RE = [
  /\.DS_Store$/, /Thumbs\.db$/i, /desktop\.ini$/i,
  /\.(zip|rar|7z)$/i, /sync-conflict/i,
];
const EXCLUDE_PATHS = [
  ".obsidian/workspace.json",
  ".obsidian/workspace-mobile.json",
  ".obsidian/workspaces.json",
  ".claudian/sessions",
  ".claude/sessions",
  ".claude/agents",
  "00_万法 (开箱即用·Hub)/06_课程/_视频脚本",
];
const KEEP_DIRS = [
  "10_一心 (随手丢·Inbox)/_候选记忆",
  "10_一心 (随手丢·Inbox)/周回顾",
  "00_万法 (开箱即用·Hub)/08_长期记忆/people",
  "00_万法 (开箱即用·Hub)/08_长期记忆/projects",
  "00_万法 (开箱即用·Hub)/08_长期记忆/wiki",
  "00_万法 (开箱即用·Hub)/08_长期记忆/decisions",
  "00_万法 (开箱即用·Hub)/07_第二大脑/profile",
  "纳戒",
];

const toFwd = (p) => p.split(path.sep).join("/");
const isExcludedPath = (rel) =>
  EXCLUDE_PATHS.some((p) => rel === p || rel.startsWith(p + "/"));

async function exists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

// ── 收集文件（递归）
async function collectFiles(dir, base, acc) {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (EXCLUDE_TOP.has(e.name)) continue;
    const abs = path.join(dir, e.name);
    const rel = toFwd(path.relative(base, abs));
    if (e.isDirectory()) {
      if (isExcludedPath(rel)) continue;
      await collectFiles(abs, base, acc);
    } else if (e.isFile()) {
      if (dir === base && EXCLUDE_ROOT_FILES.has(e.name)) continue;
      if (EXCLUDE_FILE_RE.some((re) => re.test(e.name))) continue;
      if (isExcludedPath(rel)) continue;
      acc.push({ rel, abs });
    }
  }
}

// ── 敏感配置清理（移植自旧 pack-release.sh 的 python 逻辑）
function sanitizeClaudian(abs) {
  const data = JSON.parse(fs.readFileSync(abs, "utf8"));
  data.userName = "";
  data.permissionMode = "default";
  data.systemPrompt = "";
  data.persistentExternalContextPaths = [];
  data.sharedEnvironmentVariables = "";
  data.envSnippets = [];
  const pcs = data.providerConfigs || {};
  for (const p of ["claude", "codex", "opencode", "pi"]) {
    if (pcs[p]) {
      if ("environmentVariables" in pcs[p]) pcs[p].environmentVariables = "";
      if ("environmentHash" in pcs[p]) pcs[p].environmentHash = "";
    }
  }
  return strToU8(JSON.stringify(data, null, 2));
}

// ── 生成 _update-manifest.json（从模板注入版本/日期）
async function buildManifest() {
  const tplPath = path.join(ROOT, "spiral-updater-src", "manifest", "_update-manifest.template.json");
  const tpl = JSON.parse(await fsp.readFile(tplPath, "utf8"));
  tpl.templateVersion = VERSION;
  tpl.releasedAt = RELEASED_AT;
  return strToU8(JSON.stringify(tpl, null, 2));
}

// ── 主流程
async function main() {
  console.log(`📦 互为螺旋·知识操作系统 — 跨平台打包`);
  console.log(`   版本: v${VERSION}   输出: ${OUT_DIR}\n`);

  if (!(await exists(path.join(ROOT, "首页.md")))) {
    console.error("❌ 找不到 首页.md，请确认在仓库根目录运行");
    process.exit(1);
  }

  const files = [];
  await collectFiles(ROOT, ROOT, files);

  // 注入 spiral-updater 插件产物
  const updaterDist = path.join(ROOT, "spiral-updater-src", "dist");
  if (await exists(updaterDist)) {
    for (const f of ["main.js", "manifest.json", "styles.css"]) {
      const abs = path.join(updaterDist, f);
      if (await exists(abs)) files.push({ rel: `.obsidian/plugins/spiral-updater/${f}`, abs });
    }
  } else {
    console.warn("   ⚠️ 未找到 spiral-updater-src/dist，请先在该目录运行 npm run build");
  }

  // 构建 zip 对象（敏感文件内存清理）
  const zipObj = {};
  for (const { rel, abs } of files) {
    let bytes;
    if (rel === ".claudian/claudian-settings.json") bytes = sanitizeClaudian(abs);
    else if (rel === ".obsidian/plugins/realclaudian/data.json") bytes = strToU8("{}");
    else bytes = fs.readFileSync(abs); // Buffer (Uint8Array)
    zipObj[rel] = bytes;
  }

  // 注入 _update-manifest.json
  zipObj["_update-manifest.json"] = await buildManifest();

  // 空目录 .gitkeep
  for (const d of KEEP_DIRS) {
    const has = Object.keys(zipObj).some((k) => k.startsWith(d + "/"));
    if (!has) zipObj[d + "/.gitkeep"] = strToU8("");
  }

  // 打包（fflate: UTF-8 文件名，跨平台一致）
  const zipped = zipSync(zipObj, { level: 6 });

  await fsp.mkdir(OUT_DIR, { recursive: true });
  const zipPath = path.join(OUT_DIR, ZIP_NAME);
  fs.writeFileSync(zipPath, Buffer.from(zipped));

  const sha256 = createHash("sha256").update(Buffer.from(zipped)).digest("hex");

  // latest.json
  const latest = {
    templateVersion: VERSION,
    releasedAt: RELEASED_AT,
    downloadUrl: `https://github.com/${RELEASE_REPO}/releases/download/v${VERSION}/${ZIP_NAME}`,
    sha256,
    manifestUrl: `https://raw.githubusercontent.com/${RELEASE_REPO}/main/latest.json`,
  };
  fs.writeFileSync(path.join(OUT_DIR, "latest.json"), JSON.stringify(latest, null, 2));

  // 汇总
  const sizeMB = (zipped.length / 1024 / 1024).toFixed(2);
  console.log(`✅ 打包完成`);
  console.log(`   📦 ${zipPath}  (${sizeMB} MB, ${Object.keys(zipObj).length} 个文件)`);
  console.log(`   🔑 sha256: ${sha256}`);
  console.log(`   📄 latest.json 已生成`);
  console.log(`\n   发版步骤:`);
  console.log(`   1. GitHub Release v${VERSION} 上传 ${ZIP_NAME}`);
  console.log(`   2. 用生成的 latest.json 覆盖 ${RELEASE_REPO} 仓库根`);
}

main().catch((e) => {
  console.error("❌ 打包失败:", e);
  process.exit(1);
});
