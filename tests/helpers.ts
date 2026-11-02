import { buildGameData, saveContextFrom } from '../src/core/data';
export const data = buildGameData();
export const ctx = saveContextFrom(data);
