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

// 4. 创建 Release + 上传 zip(notes 写临时文件避免命令行转义)
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

// 5. latest.json 提交 + push
fs.copyFileSync(path.join(DIST, "latest.json"), path.join(ROOT, "latest.json"));
run("git add latest.json");
try {
  run(`git commit -m "chore(release): v${ver} 更新指针 latest.json"`);
} catch {
  console.log("   (latest.json 无变化，跳过 commit)");
}
run("git push origin master");

console.log(`\n🎉 v${ver} 发布完成！`);
console.log(`   Release: https://github.com/${REPO}/releases/tag/v${ver}`);
console.log(`   用户在 Obsidian「检查模板更新」即可收到。`);
