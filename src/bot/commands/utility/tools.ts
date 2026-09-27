/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { buildCommandGroup } from '../../modules/commandGroup.js';
import type { Command } from '../../types.js';

import reminder from './parts/reminder.js';
import schedule from './parts/schedule.js';
import tags from './parts/tags.js';
import sticky from './parts/sticky.js';
import say from './parts/say.js';
import announce from './parts/announce.js';
import backup from './parts/backup.js';
import wiki from './parts/wiki.js';
import mcstatus from './parts/mcstatus.js';

const command: Command = buildCommandGroup({
  name: 'tools',
  description: 'Pripomienky, tagy, sticky správy, zálohy a ďalšie nástroje',
  category: 'utility',
  children: [reminder, schedule, tags, sticky, say, announce, wiki, mcstatus, backup],
});

export default command;
