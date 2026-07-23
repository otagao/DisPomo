import {
  app,
  Menu,
  nativeImage,
  Tray,
  type BrowserWindow
} from "electron";

const TRAY_ICON =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAfUlEQVR42mNgoDZgYGBg+A8EPhA1MDAw/GdgYGB4zwjE/4eBgYGBCZtBgrGBAUwMDAz/oRiYGBgY/pPhPwwMDAz/Gf6TYTMMDAwM/xn+M/zH8J/hP8N/Bv8M/xn+M/xn+A+DgYHhP8N/Bv8M/xn+M/xn+A+DgYHhPwMTwx8GBgYGBgB7qR8OQXkw0AAAAABJRU5ErkJggg==";

export class TrayController {
  private tray: Tray | undefined;

  constructor(private readonly window: () => BrowserWindow | undefined) {}

  create(): void {
    if (this.tray) return;
    const image = nativeImage.createFromDataURL(TRAY_ICON);
    if (process.platform === "darwin") image.setTemplateImage(true);
    this.tray = new Tray(image);
    this.tray.setToolTip("DisPomo");
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "DisPomo を表示",
          click: () => this.showWindow()
        },
        { type: "separator" },
        {
          label: "終了",
          click: () => app.quit()
        }
      ])
    );
    this.tray.on("click", () => this.showWindow());
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = undefined;
  }

  private showWindow(): void {
    const target = this.window();
    if (!target) return;
    target.show();
    target.focus();
  }
}
