import { describe, expect, it } from 'vitest';
import {
  SETTINGS_FIELDS,
  canonicalModuleKey,
  defaultSettings,
  getModuleConfig,
  isModuleEnabled,
  moduleEnabled,
  toDashboardFormat,
  toStorageFormat,
  withDefaults,
} from '../src/shared/settingsSchema';
import { MODULES, defaultModuleState } from '../src/shared/moduleRegistry';

describe('schéma - celistvosť', () => {
  it('žiadne dve polia nezdieľajú ten istý kľúč', () => {
    const keys = SETTINGS_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('žiadne dve polia nezdieľajú ten istý stĺpec', () => {
    const columns = SETTINGS_FIELDS.map((f) => f.column);
    expect(new Set(columns).size).toBe(columns.length);
  });

  it('predvolené hodnoty sú zakaždým nová kópia', () => {
    const a = defaultSettings();
    const b = defaultSettings();
    a.automod.enabled = true;
    expect(b.automod.enabled).toBe(false);
  });

  it('každý modul z registra má predvolený stav', () => {
    const state = defaultModuleState();
    for (const module of MODULES) {
      expect(state).toHaveProperty(module.key);
      expect(typeof state[module.key]).toBe('boolean');
    }
  });

  it('predvolené nastavenia obsahujú presne moduly z registra', () => {
    const modules = Object.keys(defaultSettings().modules).sort();
    const registry = MODULES.map((m) => m.key).sort();
    expect(modules).toEqual(registry);
  });
});

describe('prevody medzi dashboardom a diskom', () => {
  it('okružná cesta zachová hodnoty', () => {
    const dash = {
      ...defaultSettings(),
      prefix: '?',
      language: 'sk',
      welcomeChannel: '123',
      tempChannels: { enabled: true, triggerChannel: '456' },
      botNickname: 'Vorqul',
    };

    const stored = toStorageFormat('999', dash);
    expect(stored.guild_id).toBe('999');
    expect(stored.welcome_channel).toBe('123');
    expect(stored.temp_channels).toEqual({ enabled: true, triggerChannel: '456' });
    expect(stored.bot_nickname).toBe('Vorqul');
    expect(stored.welcomeChannel).toBeUndefined();

    const back = toDashboardFormat(stored)!;
    expect(back.prefix).toBe('?');
    expect(back.welcomeChannel).toBe('123');
    expect(back.tempChannels).toEqual({ enabled: true, triggerChannel: '456' });
    expect(back.guildId).toBe('999');
  });

  it('neznáme kľúče prežijú oboma smermi', () => {
    const stored = toStorageFormat('1', { experimentalThing: { a: 1 } });
    expect(stored.experimentalThing).toEqual({ a: 1 });

    const back = toDashboardFormat({ guild_id: '1', experimentalThing: { a: 1 } })!;
    expect(back.experimentalThing).toEqual({ a: 1 });
  });

  it('technické stĺpce sa nedostanú do dashboard tvaru', () => {
    const back = toDashboardFormat({
      guild_id: '1',
      created_at: 'x',
      updated_at: 'y',
      schema_version: 1,
      temp_actions: [],
    })!;
    expect(back.created_at).toBeUndefined();
    expect(back.schema_version).toBeUndefined();
    expect(back.temp_actions).toBeUndefined();
  });

  it('chýbajúce polia sa doplnia predvolenou hodnotou', () => {
    const back = toDashboardFormat({ guild_id: '1' })!;
    expect(back.prefix).toBe('!');
    expect(back.games).toEqual({});
    expect(back.reactionRoles).toEqual({ buttons: [] });
  });

  it('uložený tvar sa nepremaže predvolenými hodnotami', () => {
    const back = toDashboardFormat({ guild_id: '1', modules: { leveling: false } })!;
    expect(back.modules).toEqual({ leveling: false });
  });

  it('withDefaults doplní chýbajúce vetvy, ale nepremaže uložené', () => {
    const merged = withDefaults({ automod: { enabled: true } });
    expect(merged.automod.enabled).toBe(true);
    expect(merged.automod.spam.maxMessages).toBe(5);
  });

  it('prázdny záznam vráti null', () => {
    expect(toDashboardFormat(null)).toBeNull();
  });
});

describe('moduly a ich staré mená', () => {
  it('aliasy vedú na kanonický kľúč', () => {
    expect(canonicalModuleKey('logging')).toBe('logs');
    expect(canonicalModuleKey('tempchannels')).toBe('tempChannels');
    expect(canonicalModuleKey('antiraid')).toBe('antiRaid');
    expect(canonicalModuleKey('leveling')).toBe('leveling');
  });

  it('moduleEnabled zvláda boolean aj objekt', () => {
    expect(moduleEnabled(true)).toBe(true);
    expect(moduleEnabled(false)).toBe(false);
    expect(moduleEnabled({ enabled: true })).toBe(true);
    expect(moduleEnabled({ enabled: false })).toBe(false);
    expect(moduleEnabled(undefined, true)).toBe(true);
    expect(moduleEnabled({ foo: 1 }, true)).toBe(true);
  });

  it('modul uložený pod starým menom sa nájde pod novým', () => {
    const settings = { modules: { logging: true, tempchannels: { enabled: true } } };
    expect(isModuleEnabled(settings, 'logs', false)).toBe(true);
    expect(isModuleEnabled(settings, 'tempChannels', false)).toBe(true);
  });

  it('modul uložený pod novým menom sa nájde aj pri opytovaní starým', () => {
    const settings = { modules: { logs: false } };
    expect(isModuleEnabled(settings, 'logging', true)).toBe(false);
  });

  it('kanonický kľúč má prednosť pred aliasom', () => {
    const settings = { modules: { logs: false, logging: true } };
    expect(isModuleEnabled(settings, 'logs', true)).toBe(false);
  });

  it('chýbajúci modul vráti zadanú predvolenú hodnotu', () => {
    expect(isModuleEnabled({ modules: {} }, 'leveling', true)).toBe(true);
    expect(isModuleEnabled({}, 'leveling', false)).toBe(false);
    expect(isModuleEnabled(null, 'leveling', true)).toBe(true);
  });

  it('getModuleConfig vráti objekt aj cez alias', () => {
    const settings = { modules: { tempchannels: { enabled: true, category: '5' } } };
    expect(getModuleConfig(settings, 'tempChannels')).toEqual({ enabled: true, category: '5' });
    expect(getModuleConfig({ modules: { logs: true } }, 'logs')).toEqual({});
  });
});
