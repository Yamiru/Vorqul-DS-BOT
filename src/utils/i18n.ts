/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getCustomText } from './customTexts.js';
import { getGuildLanguageFromDisk } from './guildCache.js';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Translations {
  [key: string]: string | Translations;
}

interface LanguageData {
  [lang: string]: Translations;
}

class I18n {
  private languages: LanguageData = {};
  private defaultLang = 'en';
  private guildLanguages: Map<string, string> = new Map();
  private dbLoader: ((guildId: string) => Promise<string | null>) | null = null;

  constructor() {
    this.loadLanguages();
  }

  private loadLanguages(): void {
    const possiblePaths = [
      path.join(__dirname, '..', 'locales'),
      path.join(__dirname, '..', '..', 'locales'),
      path.join(__dirname, '..', '..', 'src', 'locales'),
      path.join(process.cwd(), 'src', 'locales'),
      path.join(process.cwd(), 'locales'),
    ];

    let localesDir: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        localesDir = p;
        break;
      }
    }

    if (!localesDir) {
      logger.warn('[i18n] Locales directory not found, tried:', possiblePaths);
      return;
    }

    logger.info(`[i18n] Found locales at: ${localesDir}`);
    const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
      const lang = file.replace('.json', '');
      const filePath = path.join(localesDir, file);

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        this.languages[lang] = JSON.parse(content);
        logger.info(`[i18n] Loaded language: ${lang}`);
      } catch (err) {
        logger.error(`Failed to load language file: ${file}`, err);
      }
    }

    logger.info(`[i18n] Available languages: ${Object.keys(this.languages).join(', ')}`);
  }

  setDbLoader(loader: (guildId: string) => Promise<string | null>): void {
    this.dbLoader = loader;
  }

  setGuildLanguage(guildId: string, lang: string): void {
    if (this.languages[lang]) {
      this.guildLanguages.set(guildId, lang);
    }
  }

  getGuildLanguage(guildId: string): string {
    const stored = getGuildLanguageFromDisk(guildId);
    if (stored && this.languages[stored]) {
      this.guildLanguages.set(guildId, stored);
      return stored;
    }

    const cached = this.guildLanguages.get(guildId);
    if (cached && this.languages[cached]) return cached;

    return this.defaultLang;
  }

  async getGuildLanguageAsync(guildId: string): Promise<string> {
    const cached = this.guildLanguages.get(guildId);
    if (cached && this.languages[cached]) return cached;

    if (this.dbLoader) {
      try {
        const loaded = await this.dbLoader(guildId);
        if (loaded && this.languages[loaded]) {
          this.guildLanguages.set(guildId, loaded);
          return loaded;
        }
      } catch (error) {
          logger.debug('i18n: suppressed error', error);
        }
    }

    return this.defaultLang;
  }

  availableLanguages(): string[] {
    return Object.keys(this.languages);
  }

  private getNestedValue(obj: Translations, path: string): string | undefined {
    const keys = path.split('.');
    let current: Translations | string = obj;

    for (const key of keys) {
      if (typeof current === 'string') return undefined;
      if (current[key] === undefined) return undefined;
      current = current[key];
    }

    return typeof current === 'string' ? current : undefined;
  }

  tLang(key: string, lang: string, replacements?: Record<string, string>): string {
    const translations = this.languages[lang] || this.languages[this.defaultLang];
    if (!translations) return key;

    let text = this.getNestedValue(translations, key);
    if (!text && lang !== this.defaultLang) {
      text = this.getNestedValue(this.languages[this.defaultLang], key);
    }
    if (!text) return key;

    if (replacements) {
      for (const [placeholder, value] of Object.entries(replacements)) {
        text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), () => value);
      }
    }
    return text;
  }

  t(key: string, guildId?: string, replacements?: Record<string, string>): string {
    const lang = guildId ? this.getGuildLanguage(guildId) : this.defaultLang;
    const translations = this.languages[lang] || this.languages[this.defaultLang];

    if (!translations) {
      return key;
    }

    let text = guildId ? getCustomText(guildId, key) : undefined;

    if (!text) text = this.getNestedValue(translations, key);

    if (!text && lang !== this.defaultLang) {
      text = this.getNestedValue(this.languages[this.defaultLang], key);
    }

    if (!text) {
      return key;
    }

    if (replacements) {
      for (const [placeholder, value] of Object.entries(replacements)) {
        text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), () => value);
      }
    }

    return text;
  }

  async tAsync(key: string, guildId?: string, replacements?: Record<string, string>): Promise<string> {
    const lang = guildId ? await this.getGuildLanguageAsync(guildId) : this.defaultLang;
    const translations = this.languages[lang] || this.languages[this.defaultLang];

    if (!translations) {
      return key;
    }

    let text = guildId ? getCustomText(guildId, key) : undefined;

    if (!text) text = this.getNestedValue(translations, key);

    if (!text && lang !== this.defaultLang) {
      text = this.getNestedValue(this.languages[this.defaultLang], key);
    }

    if (!text) {
      return key;
    }

    if (replacements) {
      for (const [placeholder, value] of Object.entries(replacements)) {
        text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), () => value);
      }
    }

    return text;
  }

  getAvailableLanguages(): string[] {
    return Object.keys(this.languages);
  }

  reload(): void {
    this.languages = {};
    this.loadLanguages();
  }

  async preloadGuildLanguages(loader: () => Promise<Array<{ guildId: string; language: string }>>): Promise<void> {
    try {
      const guilds = await loader();
      for (const { guildId, language } of guilds) {
        if (language && this.languages[language]) {
          this.guildLanguages.set(guildId, language);
        }
      }
      logger.info(`[i18n] Preloaded languages for ${guilds.length} guilds`);
    } catch (err) {
      logger.error('[i18n] Failed to preload guild languages:', err);
    }
  }
}

export const i18n = new I18n();
export default I18n;
