/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { buildCommandGroup } from '../../modules/commandGroup.js';
import type { Command } from '../../types.js';

import crypto from './parts/crypto.js';
import nft from './parts/nft.js';
import stock from './parts/stock.js';

const command: Command = buildCommandGroup({
  name: 'crypto',
  description: 'Kurzy kryptomien, NFT a akcie',
  category: 'utility',
  children: [
    { command: crypto, as: 'price' },
    nft,
    stock,
  ],
});

export default command;
