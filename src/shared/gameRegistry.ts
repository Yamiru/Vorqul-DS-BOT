/*!
 * Vorqul DS BOT - Game Registry
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
export interface GameSetting {
  key: string;
  label: string;
  type: 'number' | 'boolean';
  min?: number;
  max?: number;
  default: number | boolean;
  hint?: string;
}

export interface GameDefinition {
  key: string;

  command: string;
  label: string;
  emoji: string;
  description: string;
  multiplayer: boolean;
  settings: GameSetting[];
}

const COOLDOWN: GameSetting = {
  key: 'cooldown',
  label: 'Cooldown (sekundy)',
  type: 'number',
  min: 0,
  max: 3600,
  default: 5,
  hint: 'gameOpts.cooldownHint',
};

export const GAMES: GameDefinition[] = [
  {
    key: 'tictactoe',
    command: 'tictactoe',
    label: 'gameDefs.tictactoe.label',
    emoji: '⭕',
    description: 'gameDefs.tictactoe.description',
    multiplayer: true,
    settings: [
      COOLDOWN,
      { key: 'allowBot', label: 'Hra proti botovi', type: 'boolean', default: true },
      { key: 'timeoutSeconds', label: 'gameOpts.turnTimeout', type: 'number', min: 10, max: 600, default: 120 },
    ],
  },
  {
    key: 'connect4',
    command: 'connect4',
    label: 'gameDefs.connect4.label',
    emoji: '🔴',
    description: 'gameDefs.connect4.description',
    multiplayer: true,
    settings: [
      COOLDOWN,
      { key: 'timeoutSeconds', label: 'gameOpts.turnTimeout', type: 'number', min: 10, max: 600, default: 120 },
    ],
  },
  {
    key: 'rps',
    command: 'rps',
    label: 'gameDefs.rps.label',
    emoji: '✂️',
    description: 'gameDefs.rps.description',
    multiplayer: true,
    settings: [COOLDOWN],
  },
  {
    key: 'trivia',
    command: 'trivia',
    label: 'gameDefs.trivia.label',
    emoji: '🧠',
    description: 'gameDefs.trivia.description',
    multiplayer: true,
    settings: [
      COOLDOWN,
      { key: 'timeoutSeconds', label: 'gameOpts.answerTimeout', type: 'number', min: 5, max: 300, default: 30 },
      { key: 'rewardCoins', label: 'gameOpts.correctReward', type: 'number', min: 0, max: 10000, default: 10 },
    ],
  },
  {
    key: 'dice',
    command: 'dice',
    label: 'gameDefs.dice.label',
    emoji: '🎲',
    description: 'gameDefs.dice.description',
    multiplayer: false,
    settings: [COOLDOWN],
  },
  {
    key: 'coinflip',
    command: 'coinflip',
    label: 'gameDefs.coinflip.label',
    emoji: '🪙',
    description: 'gameDefs.coinflip.description',
    multiplayer: false,
    settings: [COOLDOWN],
  },
  {
    key: 'eightball',
    command: '8ball',
    label: 'gameDefs.eightball.label',
    emoji: '🎱',
    description: 'gameDefs.eightball.description',
    multiplayer: false,
    settings: [COOLDOWN],
  },
  {
    key: 'matchmaking',
    command: 'matchmaking',
    label: 'gameDefs.matchmaking.label',
    emoji: '🤝',
    description: 'gameDefs.matchmaking.description',
    multiplayer: true,
    settings: [
      { key: 'cooldown', label: 'Cooldown (sekundy)', type: 'number', min: 0, max: 3600, default: 60 },
      { key: 'maxOpenPosts', label: 'gameOpts.maxOpenLobbies', type: 'number', min: 1, max: 10, default: 2 },
    ],
  },
  {
    key: 'quest',
    command: 'quest',
    label: 'gameDefs.quest.label',
    emoji: '📜',
    description: 'gameDefs.quest.description',
    multiplayer: false,
    settings: [
      { key: 'cooldown', label: 'Cooldown (sekundy)', type: 'number', min: 0, max: 3600, default: 10 },
      { key: 'dailyLimit', label: 'gameOpts.dailyQuests', type: 'number', min: 1, max: 20, default: 3 },
    ],
  },
  {
    key: 'gamestats',
    command: 'gamestats',
    label: 'gameDefs.gamestats.label',
    emoji: '📊',
    description: 'gameDefs.gamestats.description',
    multiplayer: false,
    settings: [COOLDOWN],
  },
];

export const COMMAND_TO_GAME: Record<string, string> = GAMES.reduce(
  (map, game) => {
    map[game.command] = game.key;
    return map;
  },
  {} as Record<string, string>
);

export function getGame(key: string): GameDefinition | undefined {
  return GAMES.find((game) => game.key === key);
}

export function gameScopeKey(key: string): string {
  return `games.${key}`;
}

export function isGameEnabled(settings: any, key: string): boolean {
  const stored = settings?.games?.[key];

  if (typeof stored === 'boolean') return stored;
  if (stored && typeof stored === 'object' && typeof stored.enabled === 'boolean') {
    return stored.enabled;
  }

  const module = settings?.modules?.games;
  if (typeof module === 'boolean') return module;
  if (module && typeof module === 'object' && typeof module.enabled === 'boolean') {
    return module.enabled;
  }

  return true;
}

export function getGameSetting(settings: any, key: string, settingKey: string): number | boolean {
  const game = getGame(key);
  const definition = game?.settings.find((s) => s.key === settingKey);
  const fallback = definition ? definition.default : 0;

  const value = settings?.games?.[key]?.[settingKey];
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  return fallback;
}

export function resolveGameScopeFeature(settings: any, gameKey: string): string {
  const specific = settings?.channelScopes?.[`games.${gameKey}`];
  const mode = specific?.mode;
  const hasChannels = Array.isArray(specific?.channels) && specific.channels.length > 0;

  if ((mode === 'only' && hasChannels) || mode === 'except') {
    return `games.${gameKey}`;
  }
  return 'games';
}
