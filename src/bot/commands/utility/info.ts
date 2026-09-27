/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { buildCommandGroup } from '../../modules/commandGroup.js';
import type { Command } from '../../types.js';

import userinfo from './parts/userinfo.js';
import serverinfo from './parts/serverinfo.js';
import avatar from './parts/avatar.js';
import membercount from './parts/membercount.js';
import serverhealth from './parts/serverhealth.js';
import names from './parts/names.js';
import ping from './parts/ping.js';

const command: Command = buildCommandGroup({
  name: 'info',
  description: 'Informácie o používateľoch, serveri a stave bota',
  category: 'utility',
  children: [
    { command: userinfo, as: 'user' },
    { command: serverinfo, as: 'server' },
    avatar,
    { command: membercount, as: 'members' },
    names,
    { command: serverhealth, as: 'health' },
    ping,
  ],
});

export default command;
