import { app, BrowserWindow, dialog } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RepoController } from "./core/repo-controller.js";
import { registerController, unregisterController, registerHandlers } from "./ipc/handlers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

const loadWindow = async (window: BrowserWindow): Promise<void> => {
  const rendererUrl = process.env.VITE_DEV_SERVER_URL;

  if (rendererUrl) {
    await window.loadURL(rendererUrl);
    return;
  }

  await window.loadFile(path.resolve(__dirname, "../dist/index.html"));
};

const createMainWindow = async (): Promise<BrowserWindow> => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1512,
    height: 982,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#09090b",
    title: "Grove",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const controller = new RepoController((snapshot) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("app:snapshot", snapshot);
    }
  });

  registerController(mainWindow.id, controller);

  mainWindow.on("closed", () => {
    if (mainWindow) {
      unregisterController(mainWindow.id);
    }
    mainWindow = null;
  });

  await loadWindow(mainWindow);
  return mainWindow;
};

registerHandlers();

app.whenReady().then(createMainWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});
