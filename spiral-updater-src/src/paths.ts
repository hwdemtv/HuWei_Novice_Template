// 覆盖规则真相源 + 跨平台路径归一化
// includeGlobs/excludeGlobs 的语义与本仓库根
// spiral-updater-src/manifest/_update-manifest.template.json 保持一致。

import { Minimatch } from "minimatch";

/** NFC 归一化 —— 修掉 macOS 文件系统 NFD 与 zip 内 NFC 不一致的隐藏 bug（影响 ·、📖 等） */
export function norm(p: string): string {
  return p.normalize("NFC");
}

/** 统一为正斜杠（vault adapter 跨平台约定） */
export function toForward(p: string): string {
  return p.replace(/\\/g, "/");
}

export interface UpdateManifest {
  schemaVersion: number;
  templateVersion: string;
  releasedAt?: string;
  includeGlobs: string[];
  excludeGlobs: string[];
  deletions?: string[];
  releaseNotes?: string;
}

const TEXT_EXT = new Set([
  "md", "json", "canvas", "css", "js", "mjs", "ts",
  "txt", "csv", "html", "htm", "yaml", "yml",
]);

/** 按扩展名判定是否文本（决定用 write 还是 writeBinary） */
export function isTextPath(p: string): boolean {
  const ext = p.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXT.has(ext);
}

function matcher(glob: string): Minimatch {
  return new Minimatch(norm(glob), { dot: true });
}

/**
 * 判断 zip 内某相对路径是否应被覆盖到 vault。
 * 规则：排除优先 → 命中 include 才放行 → 其余默认拒绝。
 */
export function shouldOverwrite(relPath: string, manifest: UpdateManifest): boolean {
  const p = norm(toForward(relPath));
  for (const ex of manifest.excludeGlobs) {
    if (matcher(ex).match(p)) return false;
  }
  for (const inc of manifest.includeGlobs) {
    if (matcher(inc).match(p)) return true;
  }
  return false;
}
