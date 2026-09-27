import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  COMMAND_TO_GAME,
  GAMES,
  gameScopeKey,
  getGame,
  getGameSetting,
  isGameEnabled,
  resolveGameScopeFeature,
} from '../src/shared/gameRegistry';
import { FEATURE_KEYS } from '../src/shared/channelScopeRegistry';

describe('register hier - celistvosť', () => {
  it('kľúče sú jedinečné', () => {
    const keys = GAMES.map((g) => g.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('mená príkazov sú jedinečné', () => {
    const commands = GAMES.map((g) => g.command);
    expect(new Set(commands).size).toBe(commands.length);
  });

  it('každá hra má rozsah kanálov', () => {
    for (const game of GAMES) {
      expect(FEATURE_KEYS).toContain(gameScopeKey(game.key));
    }
  });

  it('rozsahy games.* neobsahujú hru, ktorá neexistuje', () => {
    const known = new Set(GAMES.map((g) => g.key));
    const orphans = FEATURE_KEYS
      .filter((key) => key.startsWith('games.'))
      .filter((key) => !known.has(key.slice('games.'.length)));
    expect(orphans).toEqual([]);
  });

  it('každá hra má súbor príkazu', () => {
    const dir = path.resolve(__dirname, '../src/bot/commands/fun');
    const economy = path.resolve(__dirname, '../src/bot/commands/economy');
    for (const game of GAMES) {
      const exists =
        fs.existsSync(path.join(dir, `${game.command}.ts`)) ||
        fs.existsSync(path.join(economy, `${game.command}.ts`));
      expect(exists, `chýba príkaz pre hru ${game.key}`).toBe(true);
    }
  });

  it('mapa príkaz -> hra pokrýva všetky hry', () => {
    for (const game of GAMES) {
      expect(COMMAND_TO_GAME[game.command]).toBe(game.key);
    }
  });

  it('getGame nájde hru a neznámu vráti ako undefined', () => {
    expect(getGame('dice')?.command).toBe('dice');
    expect(getGame('hangman')).toBeUndefined();
  });
});

describe('isGameEnabled', () => {
  it('bez nastavenia je hra zapnutá', () => {
    expect(isGameEnabled({}, 'dice')).toBe(true);
  });

  it('objekt s enabled rozhoduje', () => {
    expect(isGameEnabled({ games: { dice: { enabled: false } } }, 'dice')).toBe(false);
    expect(isGameEnabled({ games: { dice: { enabled: true } } }, 'dice')).toBe(true);
  });

  it('starší boolean tvar naďalej funguje', () => {
    expect(isGameEnabled({ games: { dice: false } }, 'dice')).toBe(false);
    expect(isGameEnabled({ games: { dice: true } }, 'dice')).toBe(true);
  });

  it('nastavenie hry prebije spoločný prepínač modulu', () => {
    const settings = { modules: { games: false }, games: { dice: { enabled: true } } };
    expect(isGameEnabled(settings, 'dice')).toBe(true);
  });

  it('bez nastavenia hry platí spoločný prepínač modulu', () => {
    expect(isGameEnabled({ modules: { games: false } }, 'dice')).toBe(false);
    expect(isGameEnabled({ modules: { games: { enabled: false } } }, 'dice')).toBe(false);
  });
});

describe('getGameSetting', () => {
  it('vráti uloženú hodnotu', () => {
    expect(getGameSetting({ games: { trivia: { cooldown: 42 } } }, 'trivia', 'cooldown')).toBe(42);
  });

  it('bez hodnoty vráti predvolenú z definície', () => {
    expect(getGameSetting({}, 'trivia', 'timeoutSeconds')).toBe(30);
    expect(getGameSetting({}, 'tictactoe', 'allowBot')).toBe(true);
  });

  it('neznáme nastavenie vráti nulu', () => {
    expect(getGameSetting({}, 'dice', 'neexistuje')).toBe(0);
  });

  it('nepravú hodnotu ignoruje', () => {
    expect(getGameSetting({ games: { dice: { cooldown: 'veľa' } } }, 'dice', 'cooldown')).toBe(5);
  });
});

describe('resolveGameScopeFeature', () => {
  it('bez vlastného pravidla platí spoločné "games"', () => {
    expect(resolveGameScopeFeature({}, 'dice')).toBe('games');
  });

  it('vlastné pravidlo "only" s kanálmi platí', () => {
    const settings = { channelScopes: { 'games.dice': { mode: 'only', channels: ['1'] } } };
    expect(resolveGameScopeFeature(settings, 'dice')).toBe('games.dice');
  });

  it('"only" bez kanálov by hru vypol, preto sa použije spoločné pravidlo', () => {
    const settings = { channelScopes: { 'games.dice': { mode: 'only', channels: [] } } };
    expect(resolveGameScopeFeature(settings, 'dice')).toBe('games');
  });

  it('vlastné pravidlo "except" platí aj bez kanálov', () => {
    const settings = { channelScopes: { 'games.dice': { mode: 'except', channels: [] } } };
    expect(resolveGameScopeFeature(settings, 'dice')).toBe('games.dice');
  });
});
