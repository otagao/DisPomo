import { join } from "node:path";
import { app, BrowserWindow, shell } from "electron";
import { AppStore } from "../database/store";
import { AppService } from "./app-service";
import { registerIpcHandlers } from "./ipc/register-handlers";
import { TrayController } from "./tray/tray-controller";

let mainWindow: BrowserWindow | undefined;
let service: AppService | undefined;
let tray: TrayController | undefined;
let quitting = false;
let tickTimer: NodeJS.Timeout | undefined;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createWindow();
    }
    mainWindow.show();
    mainWindow.focus();
  });
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: "#101318",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.once("ready-to-show", () => window.show());
  window.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      window.hide();
    }
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) {
    void window.loadURL(developmentUrl);
  } else {
    void window.loadFile(join(__dirname, "../../renderer/index.html"));
  }
  return window;
}

if (hasSingleInstanceLock) void app.whenReady().then(() => {
  const store = new AppStore(join(app.getPath("userData"), "dispomo.sqlite"));
  service = new AppService(store, () => BrowserWindow.getAllWindows());
  registerIpcHandlers(store, service);
  mainWindow = createWindow();
  tray = new TrayController(() => mainWindow);
  tray.create();

  tickTimer = setInterval(() => {
    void service?.tick();
  }, 1_000);

  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on("before-quit", () => {
  quitting = true;
  if (tickTimer) clearInterval(tickTimer);
  tray?.destroy();
  service?.close();
});

app.on("window-all-closed", () => {
  // Keep running in the tray on every supported desktop platform.
});
