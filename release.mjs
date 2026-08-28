#!/usr/bin/env node
// release.mjs — 互为螺旋 一键发版脚本
// 用法: node release.mjs <x.y.z> "<更新说明>"
// 例:   node release.mjs 1.0.1 "新增复盘三问；修复费曼卡日期bug"
//
// 自动完成: 写版本号 → 构建插件 → 打包 → 创建 GitHub Release 上传 zip → 提交 latest.json 并 push
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const args = process.argv.slice(2);
const ver = args[0];
const notes = args.slice(1).join(" ") || "例行更新";
if (!ver || !/^\d+\.\d+\.\d+$/.test(ver)) {
  console.error('❌ 用法: node release.mjs <x.y.z> "<更新说明>"');
  console.error('   例: node release.mjs 1.0.1 "新增复盘三问"');
  process.exit(1);
}

const ROOT = process.cwd();
const VAULT_NAME = path.basename(ROOT);
const REPO = "hwdemtv/HuWei_Novice_Template";
const ZIP = `${VAULT_NAME}-v${ver}.zip`;
const DIST = path.join(ROOT, "..", "dist");
const ZIP_PATH = path.join(DIST, ZIP);

const run = (cmd, cwd = ROOT) => {
  console.log("\n$ " + cmd);
  execSync(cmd, { stdio: "inherit", cwd });
};

console.log(`\n🚀 互为螺旋 · 发版 v${ver}\n   说明: ${notes}`);

// 1. 写版本号
fs.writeFileSync(path.join(ROOT, ".template-version"), ver + "\n");
console.log(`✅ .template-version → ${ver}`);

// 2. 构建插件(幂等,确保 dist 最新)
run("npm run build", path.join(ROOT, "spiral-updater-src"));

// 3. 打包(产出 zip + latest.json)
run("node pack-release.mjs");

if (!fs.existsSync(ZIP_PATH)) {
  console.error("❌ 打包后未找到 " + ZIP_PATH);
  process.exit(1);
}

// 3.5 README 插件数自检：徽章/正文数字自动对齐实际安装数与启用数（防文档漂移）
syncPluginCounts();

// 4. 快照 commit：把当前工作区（内容变更 + latest.json）全部提交，
//    让 gh release create 自动打的 tag 精确对应 zip 的字节内容（可复现）
fs.copyFileSync(path.join(DIST, "latest.json"), path.join(ROOT, "latest.json"));
run("git add -A");
try {
  run(`git commit -m "release: v${ver} 发版快照"`);
} catch {
  console.log("   (工作区无变化，跳过快照 commit)");
}

// 5. 创建 Release + 上传 zip(notes 写临时文件避免命令行转义)
const notesFile = path.join(os.tmpdir(), `spiral-notes-${ver}.txt`);
fs.writeFileSync(notesFile, notes);
try {
  run(`gh release create v${ver} "${ZIP_PATH}" --repo ${REPO} --title "v${ver} · 互为螺旋" --notes-file "${notesFile}"`);
} catch {
  console.warn("⚠️ Release 已存在，改用 upload 补传资产 + edit 更新说明");
  run(`gh release upload v${ver} "${ZIP_PATH}" --repo ${REPO} --clobber`);
  run(`gh release edit v${ver} --repo ${REPO} --notes-file "${notesFile}"`);
}
fs.unlinkSync(notesFile);

// 6. push
run("git push origin master");

console.log(`\n🎉 v${ver} 发布完成！`);
console.log(`   Release: https://github.com/${REPO}/releases/tag/v${ver}`);
console.log(`   用户在 Obsidian「检查模板更新」即可收到。`);

// README 徽章与正文里的插件数量是手工写死的，最容易漂移；发版时按实际数字修正一次。
function syncPluginCounts() {
  const pluginsDir = path.join(ROOT, ".obsidian", "plugins");
  const installed = fs.readdirSync(pluginsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
  const enabled = JSON.parse(fs.readFileSync(path.join(ROOT, ".obsidian", "community-plugins.json"), "utf8")).length;
  const advanced = installed - enabled;
  const readmePath = path.join(ROOT, "README.md");
  let readme = fs.readFileSync(readmePath, "utf8");
  const before = readme;
  readme = readme.replace(/插件-\d+个预装/, `插件-${installed}个预装`);
  readme = readme.replace(/\d+ 个预装插件（\d+ 个默认启用）/, `${installed} 个预装插件（${enabled} 个默认启用）`);
  readme = readme.replace(/另有 \d+ 个进阶插件/, `另有 ${advanced} 个进阶插件`);
  if (readme !== before) {
    fs.writeFileSync(readmePath, readme);
    console.log(`✅ README 插件数已修正：预装 ${installed} · 默认启用 ${enabled} · 进阶 ${advanced}`);
  } else {
    console.log(`✅ README 插件数无偏差：预装 ${installed} · 默认启用 ${enabled} · 进阶 ${advanced}`);
  }
}
