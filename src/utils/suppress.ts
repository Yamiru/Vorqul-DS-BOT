/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { logger } from './logger.js';

export function suppress(context: string): (error: unknown) => void {
  return (error: unknown) => logger.debug(`${context}: suppressed error`, error);
}
