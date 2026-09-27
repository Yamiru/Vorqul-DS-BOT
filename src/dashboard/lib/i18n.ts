/*!
 * Vorqul DS BOT - Dashboard i18n
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
export {
  LANGUAGES,
  LANGUAGE_CODES,
  DEFAULT_LANGUAGE,
  isLanguageCode,
  type LanguageCode,
} from './languages';

import { DEFAULT_LANGUAGE, isLanguageCode, type LanguageCode } from './languages';

import cs from '../../locales/cs.json';
import de from '../../locales/de.json';
import en from '../../locales/en.json';
import es from '../../locales/es.json';
import ja from '../../locales/ja.json';
import pl from '../../locales/pl.json';
import ru from '../../locales/ru.json';
import sk from '../../locales/sk.json';
import tr from '../../locales/tr.json';

type Bundle = Record<string, unknown>;

const BUNDLES: Record<LanguageCode, Bundle> = { cs, de, en, es, ja, pl, ru, sk, tr };

function flatten(node: unknown, prefix: string, out: Record<string, string>): void {
  if (typeof node === 'string') {
    out[prefix] = node;
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Bundle)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out);
    }
  }
}

const FLAT: Partial<Record<LanguageCode, Record<string, string>>> = {};

function strings(language: LanguageCode): Record<string, string> {
  let flat = FLAT[language];
  if (!flat) {
    flat = {};
    flatten(BUNDLES[language], '', flat);
    FLAT[language] = flat;
  }
  return flat;
}

function lookup(key: string, language: LanguageCode): string | undefined {
  const flat = strings(language);
  return flat[`ui.${key}`] ?? flat[key];
}

export function translate(
  key: string,
  language: LanguageCode,
  vars?: Record<string, string | number>
): string {
  let text = lookup(key, language) ?? lookup(key, DEFAULT_LANGUAGE) ?? lookup(key, 'en') ?? key;

  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

export function detectLanguage(): LanguageCode {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;

  for (const raw of navigator.languages || [navigator.language]) {
    const code = String(raw).slice(0, 2).toLowerCase();
    if (isLanguageCode(code)) return code;
  }
  return DEFAULT_LANGUAGE;
}
