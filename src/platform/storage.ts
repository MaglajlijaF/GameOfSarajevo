/**
 * Save-file and window bridge. In Electron the preload script exposes
 * `window.gos` which reads/writes a JSON file in the user's app-data folder.
 * In a plain browser (dev / tests) it falls back to localStorage.
 */
interface Bridge {
  readSave(): Promise<string | null>;
  writeSave(json: string): Promise<boolean>;
  setFullscreen(on: boolean): Promise<void>;
  quit(): void;
  savePath(): Promise<string>;
}

declare global { interface Window { gos?: Bridge } }

const LS_KEY = 'gameofsarajevo.save';

export const platform: Bridge & { isElectron: boolean } = {
  isElectron: typeof window !== 'undefined' && !!window.gos,
  async readSave() {
    if (window.gos) return window.gos.readSave();
    try { return localStorage.getItem(LS_KEY); } catch { return null; }
  },
  async writeSave(json: string) {
    if (window.gos) return window.gos.writeSave(json);
    try { localStorage.setItem(LS_KEY, json); return true; } catch { return false; }
  },
  async setFullscreen(on: boolean) {
    if (window.gos) return window.gos.setFullscreen(on);
    try {
      if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      if (!on && document.fullscreenElement) await document.exitFullscreen();
    } catch { /* ignored: browser may refuse without a gesture */ }
  },
  quit() { if (window.gos) window.gos.quit(); else window.close(); },
  async savePath() { return window.gos ? window.gos.savePath() : 'localStorage'; },
};
