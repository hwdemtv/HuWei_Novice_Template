# spiral-updater · 互为螺旋·更新器

「互为螺旋·知识操作系统」的安全自更新插件。让用户在 Obsidian 内一键检查并更新**模板与系统文件**，**绝不触碰笔记数据、用户画像、长期记忆、API Key**。

> 这是**开发工程目录**，不是用户数据。构建产物 `dist/` 由仓库根的 `pack-release.mjs` 注入到分发包的 `.obsidian/plugins/spiral-updater/`。

## 两个版本号（别混淆）

| 版本 | 在哪 | 含义 |
|------|------|------|
| 模板版本 | 仓库根 `.template-version` | 模板**内容**的版本，插件据此判断是否需要更新 |
| 插件版本 | `manifest.json` 的 `version` | **插件本身**的版本（插件自我升级走 Obsidian 原生更新，不走本机制） |

## 构建

```bash
cd spiral-updater-src
npm install
npm run build      # → dist/main.js + dist/manifest.json + dist/styles.css
```

开发模式（热重载）：

```bash
npm run dev
```

## 覆盖规则（真相源）

`manifest/_update-manifest.template.json` 是 includeGlobs/excludeGlobs 的**单一真相源**，插件运行时从下载包里的 `_update-manifest.json` 读取同一套规则。改覆盖范围时**只改这个模板**，打包脚本和插件会自动对齐。

## 跨平台要点

- **解压**：`fflate`（纯 JS），不依赖系统 unzip，UTF-8 文件名三平台一致
- **文件名匹配**：两端 `normalize("NFC")`，修掉 macOS NFD 隐藏 bug（影响 `·`、`📖`）
- **校验**：Web Crypto `crypto.subtle.digest("SHA-256")`
- **临时目录**：vault 内 `.spiral-updater-tmp-<ts>/`，正斜杠相对路径
- **仅桌面端**：`isDesktopOnly: true`（Win/macOS/Linux 桌面都支持，排除移动端）
