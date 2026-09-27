/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { buildCommandGroup } from '../../modules/commandGroup.js';
import type { Command } from '../../types.js';

import balance from './parts/balance.js';
import bank from './parts/bank.js';
import casino from './parts/casino.js';
import daily from './parts/daily.js';
import heist from './parts/heist.js';
import lootbox from './parts/lootbox.js';
import market from './parts/market.js';
import pay from './parts/pay.js';
import rob from './parts/rob.js';
import shop from './parts/shop.js';
import spin from './parts/spin.js';
import work from './parts/work.js';

const command: Command = buildCommandGroup({
  name: 'economy',
  description: 'Mince, banka, obchod, práca, lúpeže a kasíno',
  category: 'economy',
  children: [balance, bank, daily, work, pay, shop, market, casino, lootbox, spin, rob, heist],
});

export default command;
