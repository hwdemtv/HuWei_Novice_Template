// spiral-updater 插件入口
// 仅桌面端（isDesktopOnly: true）—— Windows / macOS / Linux 桌面版 Obsidian 均支持。
// 注意: Obsidian/Electron 不支持 window.prompt/alert/confirm，输入需用 Modal 自建。

import { App, Modal, Notice, Plugin, Setting } from "obsidian";
import { SpiralUpdater, PluginData, DEFAULT_LATEST_URL } from "./updater";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 小时静默检查一次
const STARTUP_DELAY_MS = 30_000; // 启动后 30s 静默查一次

export default class SpiralUpdaterPlugin extends Plugin {
  updater!: SpiralUpdater;

  async onload(): Promise<void> {
    this.updater = new SpiralUpdater(
      this.app,
      async () => ((await this.loadData()) as PluginData) || {},
      async (d) => this.saveData(d as any),
    );

    this.addCommand({
      id: "check-template-update",
      name: "检查模板更新",
      callback: () => this.updater.checkUpdate(false),
    });

    this.addCommand({
      id: "show-installed-version",
      name: "查看当前模板版本",
      callback: async () => {
        new Notice(`当前模板版本：v${await this.updater.installedVersion()}`);
      },
    });

    this.addCommand({
      id: "set-latest-url",
      name: "设置更新源地址（高级）",
      callback: () => this.promptLatestUrl(),
    });

    this.registerInterval(window.setTimeout(() => this.updater.checkUpdate(true), STARTUP_DELAY_MS));
    this.registerInterval(window.setInterval(() => this.updater.checkUpdate(true), CHECK_INTERVAL_MS));
  }

  private async promptLatestUrl(): Promise<void> {
    const data = ((await this.loadData()) as PluginData) || {};
    const cur = data.latestUrl || "";
    const input = await openInputModal(
      this.app,
      "设置更新源地址",
      "latest.json 地址（留空恢复默认）",
      cur,
      DEFAULT_LATEST_URL, // 占位符显示当前默认源，让用户可见
    );
    if (input === null) return; // 用户点了取消
    const trimmed = input.trim();
    await this.saveData({ ...data, latestUrl: trimmed || undefined } as any);
    new Notice(trimmed ? "已更新更新源地址" : "已恢复默认更新源", 4000);
  }
}

/** 用 Obsidian Modal 实现输入框（替代被 Electron 禁用的 window.prompt） */
function openInputModal(
  app: App,
  title: string,
  label: string,
  initial: string,
  placeholder?: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = new Modal(app);
    modal.titleEl.setText(title);
    let inputEl!: HTMLInputElement;
    new Setting(modal.contentEl)
      .setName(label)
      .addText((text) => {
        text.setValue(initial);
        if (placeholder) text.setPlaceholder(placeholder);
        inputEl = text.inputEl;
      });
    new Setting(modal.contentEl)
      .addButton((b) =>
        b.setButtonText("取消").onClick(() => {
          modal.close();
          resolve(null);
        }),
      )
      .addButton((b) =>
        b.setButtonText("确定").setCta().onClick(() => {
          modal.close();
          resolve(inputEl.value);
        }),
      );
    modal.open();
  });
}
