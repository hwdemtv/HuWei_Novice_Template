// 核心更新逻辑：检查 → 确认 → 下载 → SHA-256 校验 → fflate 解压 → 备份 → 按清单覆盖 → 记录版本
import { App, Modal, Notice, DataAdapter, requestUrl } from "obsidian";
import { unzipSync } from "fflate";
import { UpdateManifest, shouldOverwrite, isTextPath, toForward, norm } from "./paths";
import { isNewer } from "./semver";

export const DEFAULT_LATEST_URL =
  "https://raw.githubusercontent.com/hwdemtv/HuWei_Novice_Template/master/latest.json";

// 多源 fallback：raw.githubusercontent.com 国内常被 DNS 污染，依次尝试镜像源
export const LATEST_URLS = [
  DEFAULT_LATEST_URL,
  "https://cdn.jsdelivr.net/gh/hwdemtv/HuWei_Novice_Template@master/latest.json",
  "https://fastly.jsdelivr.net/gh/hwdemtv/HuWei_Novice_Template@master/latest.json",
  "https://ghp.ci/https://raw.githubusercontent.com/hwdemtv/HuWei_Novice_Template/master/latest.json",
  "https://mirror.ghproxy.com/https://raw.githubusercontent.com/hwdemtv/HuWei_Novice_Template/master/latest.json",
];

export interface LatestInfo {
  templateVersion: string;
  releasedAt?: string;
  downloadUrl: string;
  sha256: string;
  manifestUrl?: string;
  releaseNotes?: string;
}

export interface PluginData {
  installedVersion?: string;
  lastCheck?: number;
  latestUrl?: string;
}

export class SpiralUpdater {
  constructor(
    private app: App,
    private loadData: () => Promise<PluginData>,
    private saveData: (d: PluginData) => Promise<void>,
  ) {}

  async installedVersion(): Promise<string> {
    return (await this.loadData()).installedVersion || "0.0.0";
  }

  /** 依次尝试镜像源拉 latest.json，第一个成功即返回 */
  private async fetchLatestFromMirrors(): Promise<LatestInfo> {
    let lastErr: any;
    for (const u of LATEST_URLS) {
      try {
        return (await requestUrl({ url: u })).json as LatestInfo;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  }

  /** silent=true 时只在有新版才提示，否则静默 */
  async checkUpdate(silent: boolean): Promise<void> {
    let latest: LatestInfo;
    const data = await this.loadData();
    const userUrl = data.latestUrl;
    try {
      latest = userUrl
        ? (await requestUrl({ url: userUrl })).json as LatestInfo
        : await this.fetchLatestFromMirrors();
    } catch {
      if (!silent) new Notice("检查更新失败：所有更新源都无法连接");
      return;
    }
    await this.saveData({ ...data, lastCheck: Date.now() });

    const local = await this.installedVersion();
    if (!isNewer(latest.templateVersion, local)) {
      if (!silent) new Notice("已是最新版本 ✨");
      return;
    }
    new UpdateConfirmModal(this.app, latest, local, () => this.performUpdate(latest)).open();
  }

  async performUpdate(latest: LatestInfo): Promise<boolean> {
    const progress = new Notice("⬇️ 正在下载更新包…", 0);
    try {
      // 下载 zip，主链失败尝试 ghproxy 镜像兜底
      let zipBuf: ArrayBuffer;
      try {
        zipBuf = (await requestUrl({ url: latest.downloadUrl })).arrayBuffer;
      } catch {
        zipBuf = (await requestUrl({ url: "https://ghp.ci/" + latest.downloadUrl })).arrayBuffer;
      }

      const hash = await sha256Hex(zipBuf);
      if (hash.toLowerCase() !== (latest.sha256 || "").toLowerCase()) {
        progress.hide();
        new Notice("❌ 校验失败（SHA-256 不匹配），已中止，未改动任何文件。");
        return false;
      }

      const files = unzipSync(new Uint8Array(zipBuf));
      const manifestKey = Object.keys(files).find((k) => toForward(k).endsWith("_update-manifest.json"));
      if (!manifestKey) {
        progress.hide();
        new Notice("❌ 更新包缺少 _update-manifest.json，已中止。");
        return false;
      }
      const manifest: UpdateManifest = JSON.parse(new TextDecoder("utf-8").decode(files[manifestKey]));

      const ops = this.computeOps(files, manifest);
      progress.hide();

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupDir = ".更新备份_" + stamp;
      const applying = new Notice("💾 正在备份旧文件…", 0);
      await this.backupExisting(ops.writes.map((o) => o.dst), backupDir);
      await this.backupExisting(ops.deletes, backupDir);

      applying.setMessage("✍️ 正在应用更新…");
      await this.applyWrites(ops.writes, files);
      await this.applyDeletions(ops.deletes, backupDir);

      const data = await this.loadData();
      await this.saveData({ ...data, installedVersion: manifest.templateVersion });
      applying.hide();
      new Notice("✅ 更新完成 → v" + manifest.templateVersion + "\n旧文件备份在 " + backupDir + "/", 8000);
      return true;
    } catch (e: any) {
      console.error("[spiral-updater] update failed", e);
      new Notice("❌ 更新失败：" + (e?.message || e) + "。文件未改动，可重试。", 8000);
      return false;
    }
  }

  private computeOps(files: Record<string, Uint8Array>, manifest: UpdateManifest) {
    const writes: { src: string; dst: string }[] = [];
    const deletes: string[] = [];
    for (const rawPath of Object.keys(files)) {
      const rel = toForward(rawPath);
      if (rel.endsWith("_update-manifest.json")) continue;
      if (shouldOverwrite(rel, manifest)) writes.push({ src: rawPath, dst: norm(rel) });
    }
    for (const d of manifest.deletions || []) deletes.push(norm(toForward(d)));
    return { writes, deletes };
  }

  private async backupExisting(paths: string[], backupDir: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    for (const rel of paths) {
      if (!(await adapter.exists(rel))) continue;
      const dst = backupDir + "/" + rel;
      await ensureDir(adapter, dst.split("/").slice(0, -1).join("/"));
      try {
        if (isTextPath(rel)) await adapter.write(dst, await adapter.read(rel));
        else await adapter.writeBinary(dst, await adapter.readBinary(rel));
      } catch (e) {
        console.warn("[spiral-updater] backup skip", rel, e);
      }
    }
  }

  private async applyWrites(ops: { src: string; dst: string }[], files: Record<string, Uint8Array>): Promise<void> {
    const adapter = this.app.vault.adapter;
    const decoder = new TextDecoder("utf-8");
    for (const { src, dst } of ops) {
      const data = files[src];
      if (!data) continue;
      await ensureDir(adapter, dst.split("/").slice(0, -1).join("/"));
      if (isTextPath(dst)) {
        await adapter.write(dst, decoder.decode(data));
      } else {
        const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
        await adapter.writeBinary(dst, ab);
      }
    }
  }

  private async applyDeletions(deletes: string[], backupDir: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    for (const rel of deletes) {
      if (!(await adapter.exists(rel))) continue;
      try {
        await adapter.remove(rel);
      } catch (e) {
        console.warn("[spiral-updater] delete failed", rel, e);
      }
    }
  }
}

async function ensureDir(adapter: DataAdapter, dir: string): Promise<void> {
  if (!dir || dir === "." || dir === "") return;
  if (await adapter.exists(dir)) return;
  await ensureDir(adapter, dir.split("/").slice(0, -1).join("/"));
  try {
    await adapter.mkdir(dir);
  } catch {
    /* 并发创建可能已存在，忽略 */
  }
}

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

class UpdateConfirmModal extends Modal {
  constructor(
    app: App,
    private latest: LatestInfo,
    private current: string,
    private onConfirm: () => Promise<boolean>,
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("🆕 发现新版本 v" + this.latest.templateVersion);
    this.contentEl.addClass("spiral-updater-modal");
    this.contentEl.createEl("p", {
      text: "当前版本 v" + this.current + " → 新版本 v" + this.latest.templateVersion,
    });
    if (this.latest.releaseNotes) {
      this.contentEl.createEl("div", { cls: "release-notes", text: this.latest.releaseNotes });
    }
    this.contentEl.createEl("div", {
      cls: "change-summary",
      text:
        "⚠️ 更新将先备份被替换的旧文件到 .更新备份_* 目录，仅覆盖模板/系统文件，绝不触碰你的笔记、画像、长期记忆与 API Key。",
    });
    const row = this.contentEl.createDiv({ cls: "modal-button-container" });
    const cancel = row.createEl("button", { text: "稍后" });
    cancel.onclick = () => this.close();
    const ok = row.createEl("button", { text: "立即更新", cls: "mod-cta" });
    ok.onclick = async () => {
      ok.disabled = true;
      cancel.disabled = true;
      ok.setText("更新中…");
      this.close();
      await this.onConfirm();
    };
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
