import type { Lang } from './types';

export type Dict = Record<string, string>;

export class I18n {
  lang: Lang;
  constructor(private readonly dicts: Record<Lang, Dict>, lang: Lang = 'bs') { this.lang = lang; }

  /** Returns undefined when the key is missing in both the current and default language. */
  maybe(key: string): string | undefined {
    return this.dicts[this.lang]?.[key] ?? this.dicts.bs?.[key];
  }

  t(key: string, vars?: Record<string, string | number>): string {
    let s = this.maybe(key) ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }
}
