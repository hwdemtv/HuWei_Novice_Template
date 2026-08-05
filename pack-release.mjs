#!/usr/bin/env node
// 📦 互为螺旋·知识操作系统 — 跨平台分发打包脚本 (Node.js, Win/macOS/Linux)
// 用法: node pack-release.mjs [输出目录]    默认输出到 ../dist
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);
const { zipSync, strToU8 } = require("./spiral-updater-src/node_modules/fflate");

const ROOT = process.cwd();
const VAULT_NAME = path.basename(ROOT);
const OUT_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "..", "dist");
const VERSION = (await fsp.readFile(path.join(ROOT, ".template-version"), "utf8")).trim();
if (!/^\d+\.\d+\.\d+/.test(VERSION)) { console.error(`❌ .template-version 无效: "${VERSION}"`); process.exit(1); }
const ZIP_NAME = `${VAULT_NAME}-v${VERSION}.zip`;
const RELEASED_AT = new Date().toISOString().slice(0, 10);
const RELEASE_REPO = "hwdemtv/HuWei_Novice_Template";

const EXCLUDE_TOP = new Set([".git",".trash",".stfolder",".codex",".agents","node_modules","spiral-updater-src",".更新备份","dist"]);
const EXCLUDE_ROOT_FILES = new Set(["README.md",".gitignore",".stignore","pack-release.sh","pack-release.mjs","pack-release.legacy-win.sh",".template-version","发版说明.md","release.mjs"]);
const EXCLUDE_FILE_RE = [/\.DS_Store$/,/Thumbs\.db$/i,/desktop\.ini$/i,/\.(zip|rar|7z)$/i,/sync-conflict/i];
const EXCLUDE_PATHS = [".obsidian/workspace.json",".obsidian/workspace-mobile.json",".obsidian/workspaces.json",".claudian/sessions",".claude/sessions",".claude/agents","00_万法 (开箱即用·Hub)/06_课程/_视频脚本"];
const KEEP_DIRS = ["10_一心 (随手丢·Inbox)/_候选记忆","10_一心 (随手丢·Inbox)/周回顾","00_万法 (开箱即用·Hub)/08_长期记忆/people","00_万法 (开箱即用·Hub)/08_长期记忆/projects","00_万法 (开箱即用·Hub)/08_长期记忆/wiki","00_万法 (开箱即用·Hub)/08_长期记忆/decisions","00_万法 (开箱即用·Hub)/07_第二大脑/profile","纳戒"];

const toFwd = (p) => p.split(path.sep).join("/");
const isExcludedPath = (rel) => EXCLUDE_PATHS.some((p) => rel === p || rel.startsWith(p + "/"));
const exists = async (p) => { try { await fsp.access(p); return true; } catch { return false; } };

// Windows 上 Node libuv 对非 BMP emoji 文件名 open 失败 → 降级 PowerShell(.NET 正确处理 Unicode)
let psFallbackCount = 0;
function readBytes(abs) {
  try { return fs.readFileSync(abs); }
  catch {
    if (process.platform === "win32") {
      const b64 = execFileSync("powershell.exe",
        ["-NoProfile","-Command","[Convert]::ToBase64String([IO.File]::ReadAllBytes($env:TARGET))"],
        { env: { ...process.env, TARGET: abs }, maxBuffer: 200 * 1024 * 1024 }).toString().trim();
      psFallbackCount++;
      return Buffer.from(b64, "base64");
    }
    throw new Error("无法读取文件: " + abs);
  }
}

async function collectFiles(dir, base, acc) {
  for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
    if (EXCLUDE_TOP.has(e.name) || e.name.startsWith(".更新备份")) continue; // .更新备份_* 带时间戳，需前缀匹配
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

function sanitizeClaudian(abs) {
  const data = JSON.parse(readBytes(abs).toString("utf8"));
  data.userName=""; data.permissionMode="default"; data.systemPrompt="";
  data.persistentExternalContextPaths=[]; data.sharedEnvironmentVariables=""; data.envSnippets=[];
  const pcs = data.providerConfigs || {};
  for (const p of ["claude","codex","opencode","pi"]) {
    if (pcs[p]) { if ("environmentVariables" in pcs[p]) pcs[p].environmentVariables=""; if ("environmentHash" in pcs[p]) pcs[p].environmentHash=""; }
  }
  return strToU8(JSON.stringify(data, null, 2));
}

async function buildManifest() {
  const tpl = JSON.parse(await fsp.readFile(path.join(ROOT,"spiral-updater-src","manifest","_update-manifest.template.json"), "utf8"));
  tpl.templateVersion = VERSION; tpl.releasedAt = RELEASED_AT;
  return strToU8(JSON.stringify(tpl, null, 2));
}

async function main() {
  console.log(`📦 互为螺旋·知识操作系统 — 跨平台打包   v${VERSION}  →  ${OUT_DIR}\n`);
  if (!(await exists(path.join(ROOT, "首页.md")))) { console.error("❌ 找不到 首页.md，请在仓库根目录运行"); process.exit(1); }

  const files = [];
  await collectFiles(ROOT, ROOT, files);

  const updaterDist = path.join(ROOT, "spiral-updater-src", "dist");
  if (await exists(updaterDist)) {
    for (const f of ["main.js","manifest.json","styles.css"]) {
      const abs = path.join(updaterDist, f);
      if (await exists(abs)) files.push({ rel: `.obsidian/plugins/spiral-updater/${f}`, abs });
    }
  } else { console.warn("   ⚠️ 未找到 spiral-updater-src/dist，请先 npm run build"); }

  const zipObj = {};
  for (const { rel, abs } of files) {
    let bytes;
    if (rel === ".claudian/claudian-settings.json") bytes = sanitizeClaudian(abs);
    else if (rel === ".obsidian/plugins/realclaudian/data.json") bytes = strToU8("{}");
    else bytes = readBytes(abs);
    zipObj[rel] = bytes;
  }
  zipObj["_update-manifest.json"] = await buildManifest();
  for (const d of KEEP_DIRS) {
    if (!Object.keys(zipObj).some((k) => k.startsWith(d + "/"))) zipObj[d + "/.gitkeep"] = strToU8("");
  }

  const zipped = zipSync(zipObj, { level: 6 });
  await fsp.mkdir(OUT_DIR, { recursive: true });
  const zipPath = path.join(OUT_DIR, ZIP_NAME);
  fs.writeFileSync(zipPath, Buffer.from(zipped));
  const sha256 = createHash("sha256").update(Buffer.from(zipped)).digest("hex");

  const latest = {
    templateVersion: VERSION, releasedAt: RELEASED_AT,
    downloadUrl: `https://github.com/${RELEASE_REPO}/releases/download/v${VERSION}/${ZIP_NAME}`,
    sha256, manifestUrl: `https://raw.githubusercontent.com/${RELEASE_REPO}/master/latest.json`,
  };
  fs.writeFileSync(path.join(OUT_DIR, "latest.json"), JSON.stringify(latest, null, 2));

  const sizeMB = (zipped.length / 1024 / 1024).toFixed(2);
  console.log(`✅ 打包完成  📦 ${zipPath}  (${sizeMB} MB, ${Object.keys(zipObj).length} 文件)`);
  if (psFallbackCount > 0) console.log(`   🔤 ${psFallbackCount} 个 emoji 文件名经 PowerShell 降级读取`);
  console.log(`   🔑 sha256: ${sha256}`);
  console.log(`\n   发版: 1) GitHub Release v${VERSION} 上传 ${ZIP_NAME}  2) latest.json 覆盖 ${RELEASE_REPO}`);
}
main().catch((e) => { console.error("❌ 打包失败:", e); process.exit(1); });
