import { describe, expect, it } from 'vitest';
import en from '../src/locales/en.json';
import {
  COMMANDS_SCOPE_KEY,
  FEATURES,
  FEATURE_GROUPS,
  GLOBAL_SCOPE_KEY,
  describeScope,
  getScope,
  hasCustomScope,
  isAllowedInChannel,
  isCommandAllowedInChannel,
  normalizeScope,
  sanitizeScopeMap,
} from '../src/utils/channelScope';

const inChannel = (channelId: string, ...parentIds: string[]) => ({ channelId, parentIds });

describe('register funkcií', () => {
  it('kľúče sú jedinečné', () => {
    const keys = FEATURES.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('každá funkcia patrí do známej skupiny', () => {
    for (const feature of FEATURES) {
      expect(FEATURE_GROUPS).toContain(feature.group as any);
    }
  });
});

describe('normalizeScope', () => {
  it('prázdny vstup je "všade"', () => {
    expect(normalizeScope(undefined)).toEqual({ mode: 'all', channels: [] });
    expect(normalizeScope('nezmysel')).toEqual({ mode: 'all', channels: [] });
  });

  it('neznámy režim spadne na "všade"', () => {
    expect(normalizeScope({ mode: 'vsade', channels: ['1'] }).mode).toBe('all');
  });

  it('režim "only" bez kanálov by funkciu vypol, preto sa ruší', () => {
    expect(normalizeScope({ mode: 'only', channels: [] }).mode).toBe('all');
  });

  it('režim "except" bez kanálov ostáva a nikoho nevylučuje', () => {
    expect(normalizeScope({ mode: 'except', channels: [] })).toEqual({ mode: 'except', channels: [] });
  });

  it('vyhodí neplatné položky v zozname kanálov', () => {
    expect(normalizeScope({ mode: 'only', channels: ['1', '', null, 5, '2'] }).channels).toEqual(['1', '2']);
  });
});

describe('sanitizeScopeMap', () => {
  it('zahodí neznáme kľúče a rozsahy "všade"', () => {
    const out = sanitizeScopeMap({
      leveling: { mode: 'only', channels: ['1'] },
      neexistuje: { mode: 'only', channels: ['2'] },
      economy: { mode: 'all', channels: [] },
    });
    expect(Object.keys(out)).toEqual(['leveling']);
  });

  it('nepravý vstup vráti prázdnu mapu', () => {
    expect(sanitizeScopeMap(null)).toEqual({});
  });
});

describe('isAllowedInChannel', () => {
  it('bez nastavenia platí všade', () => {
    expect(isAllowedInChannel({}, 'leveling', inChannel('1'))).toBe(true);
  });

  it('režim "only" pustí len vymenované kanály', () => {
    const settings = { channelScopes: { leveling: { mode: 'only', channels: ['10'] } } };
    expect(isAllowedInChannel(settings, 'leveling', inChannel('10'))).toBe(true);
    expect(isAllowedInChannel(settings, 'leveling', inChannel('11'))).toBe(false);
  });

  it('režim "except" zakáže len vymenované kanály', () => {
    const settings = { channelScopes: { leveling: { mode: 'except', channels: ['10'] } } };
    expect(isAllowedInChannel(settings, 'leveling', inChannel('10'))).toBe(false);
    expect(isAllowedInChannel(settings, 'leveling', inChannel('11'))).toBe(true);
  });

  it('kategória platí pre kanály v nej', () => {
    const settings = { channelScopes: { leveling: { mode: 'only', channels: ['cat'] } } };
    expect(isAllowedInChannel(settings, 'leveling', inChannel('10', 'cat'))).toBe(true);
    expect(isAllowedInChannel(settings, 'leveling', inChannel('10', 'ina'))).toBe(false);
  });

  it('vlákno dedí nastavenie rodičovského kanála', () => {
    const settings = { channelScopes: { leveling: { mode: 'except', channels: ['rodic'] } } };
    expect(isAllowedInChannel(settings, 'leveling', inChannel('vlakno', 'rodic', 'cat'))).toBe(false);
  });

  it('globálny rozsah platí, kým funkcia nemá vlastný', () => {
    const settings = {
      channelScopes: {
        [GLOBAL_SCOPE_KEY]: { mode: 'only', channels: ['bot-kanal'] },
        leveling: { mode: 'except', channels: ['spam'] },
      },
    };
    expect(isAllowedInChannel(settings, 'economy', inChannel('bot-kanal'))).toBe(true);
    expect(isAllowedInChannel(settings, 'economy', inChannel('iny'))).toBe(false);

    expect(isAllowedInChannel(settings, 'leveling', inChannel('iny'))).toBe(true);
  });

  it('staré zoznamy ignorovaných kanálov sa naďalej rešpektujú', () => {
    const settings = { leveling: { blacklistChannels: ['spam'] } };
    expect(isAllowedInChannel(settings, 'leveling', inChannel('spam'))).toBe(false);
    expect(isAllowedInChannel(settings, 'leveling', inChannel('iny'))).toBe(true);
  });

  it('nový rozsah prebije starý zoznam', () => {
    const settings = {
      leveling: { blacklistChannels: ['spam'] },
      channelScopes: { leveling: { mode: 'only', channels: ['spam'] } },
    };
    expect(isAllowedInChannel(settings, 'leveling', inChannel('spam'))).toBe(true);
  });

  it('bez ID kanála sa nič neblokuje', () => {
    const settings = { channelScopes: { leveling: { mode: 'only', channels: ['10'] } } };
    expect(isAllowedInChannel(settings, 'leveling', inChannel(''))).toBe(true);
  });
});

describe('isCommandAllowedInChannel', () => {
  const settings = {
    commandScopes: { ban: { mode: 'only', channels: ['mod'] } },
    channelScopes: {
      'commands.moderation': { mode: 'only', channels: ['staff'] },
      [COMMANDS_SCOPE_KEY]: { mode: 'except', channels: ['ticho'] },
      [GLOBAL_SCOPE_KEY]: { mode: 'only', channels: ['bot'] },
    },
  };

  it('rozsah konkrétneho príkazu má najvyššiu prednosť', () => {
    expect(isCommandAllowedInChannel(settings, 'ban', 'moderation', inChannel('mod'))).toBe(true);
    expect(isCommandAllowedInChannel(settings, 'ban', 'moderation', inChannel('staff'))).toBe(false);
  });

  it('potom platí rozsah kategórie', () => {
    expect(isCommandAllowedInChannel(settings, 'kick', 'moderation', inChannel('staff'))).toBe(true);
    expect(isCommandAllowedInChannel(settings, 'kick', 'moderation', inChannel('mod'))).toBe(false);
  });

  it('potom spoločný rozsah všetkých príkazov', () => {
    expect(isCommandAllowedInChannel(settings, 'rank', 'utility', inChannel('ticho'))).toBe(false);
    expect(isCommandAllowedInChannel(settings, 'rank', 'utility', inChannel('hocikde'))).toBe(true);
  });

  it('nakoniec globálny rozsah', () => {
    const onlyGlobal = { channelScopes: { [GLOBAL_SCOPE_KEY]: { mode: 'only', channels: ['bot'] } } };
    expect(isCommandAllowedInChannel(onlyGlobal, 'rank', 'utility', inChannel('bot'))).toBe(true);
    expect(isCommandAllowedInChannel(onlyGlobal, 'rank', 'utility', inChannel('iny'))).toBe(false);
  });

  it('kategória sa porovnáva bez ohľadu na veľkosť písmen', () => {
    expect(isCommandAllowedInChannel(settings, 'kick', 'Moderation', inChannel('staff'))).toBe(true);
  });

  it('bez akéhokoľvek nastavenia je príkaz povolený', () => {
    expect(isCommandAllowedInChannel({}, 'ping', 'utility', inChannel('1'))).toBe(true);
  });
});

describe('pomocníci', () => {
  it('getScope vráti normalizovaný rozsah', () => {
    expect(getScope({}, 'leveling')).toEqual({ mode: 'all', channels: [] });
  });

  it('hasCustomScope rozpozná vlastné pravidlo', () => {
    expect(hasCustomScope({}, 'leveling')).toBe(false);
    expect(hasCustomScope({ channelScopes: { leveling: { mode: 'except', channels: ['1'] } } }, 'leveling')).toBe(true);
  });

  it('describeScope vypíše zmienky kanálov', () => {
    expect(describeScope({ mode: 'all', channels: [] })).toBe(en.scopeDesc.all);
    expect(describeScope({ mode: 'only', channels: ['1'] })).toBe(
      en.scopeDesc.only.replace('{list}', '<#1>')
    );
    expect(describeScope({ mode: 'except', channels: ['1', '2'] })).toBe(
      en.scopeDesc.except.replace('{list}', '<#1>, <#2>')
    );
  });
});
