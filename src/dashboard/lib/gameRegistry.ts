/*!
 * Vorqul DS BOT - Game Registry (dashboard)
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
export type { GameSetting, GameDefinition } from '../../shared/gameRegistry';
export {
  GAMES,
  COMMAND_TO_GAME,
  getGame,
  gameScopeKey,
  isGameEnabled,
  getGameSetting,
  resolveGameScopeFeature,
} from '../../shared/gameRegistry';
