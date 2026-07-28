// spiral-updater 构建脚本
// 用法:
//   npm run build       → 生产构建 (压缩, 输出 dist/main.js + manifest.json + styles.css)
//   npm run dev         → watch 模式
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { copyFileSync, existsSync } from "fs";

const prod = process.argv[2] === "production";

const buildOpts = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemod/autocomplete", ...builtins],
  format: "cjs",
  target: "es2020",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "dist/main.js",
};

if (!prod) {
  const ctx = await esbuild.context(buildOpts);
  await ctx.watch();
  console.log("[spiral-updater] watching for changes...");
} else {
  await esbuild.build(buildOpts);
  // 同步静态资源到 dist，供 pack-release.mjs 注入分发包
  copyFileSync("manifest.json", "dist/manifest.json");
  if (existsSync("styles.css")) copyFileSync("styles.css", "dist/styles.css");
  console.log("[spiral-updater] build complete → dist/");
}
