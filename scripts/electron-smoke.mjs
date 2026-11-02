// Launches the packaged-layout Electron app (dist + dist-electron), waits for
// the menu, and checks the JSON save file is written to the userData folder.
// Linux CI: xvfb-run -a node scripts/electron-smoke.mjs <userDataDir>
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
const req = createRequire(import.meta.url);
const { _electron } = req('playwright');
const electronPath = req('electron');
const userData = process.argv[2] ?? '/tmp/gos-userdata';
const app = await _electron.launch({ executablePath: electronPath, args: ['.', '--no-sandbox', `--user-data-dir=${userData}`] });
const win = await app.firstWindow();
const errors = [];
win.on('pageerror', (e) => errors.push(e.message));
await win.waitForFunction(() => window.__game?.scene.isActive('Menu'), null, { timeout: 20000 });
const hasBridge = await win.evaluate(() => !!window.gos);
const savePath = await win.evaluate(() => window.gos.savePath());
await win.waitForTimeout(500);
const save = JSON.parse(await readFile(savePath, 'utf8'));
await win.screenshot({ path: join(userData, 'electron-menu.png') });
await app.close();
console.log({ hasBridge, savePath, unlocked: save.unlocked, km: save.km });
if (errors.length || !hasBridge || save.unlocked[0] !== 'kovaci') { console.error(errors); process.exit(1); }
console.log('electron OK');
