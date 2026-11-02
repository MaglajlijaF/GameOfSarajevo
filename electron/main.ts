import { app, BrowserWindow, ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const savePath = () => path.join(app.getPath('userData'), 'save.json');

async function readSave(): Promise<string | null> {
  try { return await fs.readFile(savePath(), 'utf8'); } catch { return null; }
}

/** Atomic write: temp file then rename, keeping one backup. */
async function writeSave(json: string): Promise<boolean> {
  try {
    JSON.parse(json);
    const file = savePath();
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    await fs.writeFile(tmp, json, 'utf8');
    try { await fs.copyFile(file, file + '.bak'); } catch { /* first save */ }
    await fs.rename(tmp, file);
    return true;
  } catch (e) {
    console.error('save failed', e);
    return false;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 720, minWidth: 640, minHeight: 360,
    backgroundColor: '#0b0b14', title: 'Game of Sarajevo', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  ipcMain.handle('gos:fullscreen', (_e, on: boolean) => { win.setFullScreen(!!on); });
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen());
  });
}

ipcMain.handle('gos:read', () => readSave());
ipcMain.handle('gos:write', (_e, json: string) => writeSave(String(json)));
ipcMain.handle('gos:savePath', () => savePath());
ipcMain.on('gos:quit', () => app.quit());

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
