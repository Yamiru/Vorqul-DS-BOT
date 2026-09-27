'use client';
/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  detectLanguage,
  isLanguageCode,
  translate,
  type LanguageCode,
} from '@/lib/i18n';

const STORAGE_KEY = 'vorqul.language';

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key) => translate(key, DEFAULT_LANGUAGE),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isLanguageCode(saved)) {
        setLanguageState(saved);
        return;
      }
    } catch (error) {
        console.debug('LanguageProvider: suppressed error', error);
      }
    setLanguageState(detectLanguage());
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (error) {
        console.debug('LanguageProvider: suppressed error', error);
      }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(key, language, vars),
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useT() {
  return useContext(LanguageContext).t;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();

  return (
    <select
      value={language}
      onChange={(e) => setLanguage(e.target.value as LanguageCode)}
      aria-label="Language"
      className="bg-[var(--kachi)] border border-[var(--susu)] rounded-lg text-sm text-[var(--gofun)] px-2 py-1.5"
      style={{ width: compact ? 'auto' : undefined }}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.flag} {compact ? l.code.toUpperCase() : l.label}
        </option>
      ))}
    </select>
  );
}
