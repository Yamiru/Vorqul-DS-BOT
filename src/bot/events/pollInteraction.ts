/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { Client, Events, Interaction, MessageFlags } from 'discord.js';
import { getDatabase } from '../../utils/database.js';
import { buildPollEmbed, buildPollButtons, PollOption } from '../modules/pollView.js';
import { logger } from '../../utils/logger.js';

const pollLocks = new Map<string, Promise<void>>();

function withPollLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = pollLocks.get(key) || Promise.resolve();
  const result = previous.then(task, task);
  const cleanup = result.then(() => {}, () => {});
  pollLocks.set(key, cleanup);
  cleanup.finally(() => {
    if (pollLocks.get(key) === cleanup) pollLocks.delete(key);
  });
  return result;
}

const event = {
  name: Events.InteractionCreate,
  execute: async (_client: Client, interaction: Interaction) => {
    if (!interaction.isButton() || !interaction.customId.startsWith('poll_vote_')) return;

    const idx = parseInt(interaction.customId.slice('poll_vote_'.length), 10);
    if (Number.isNaN(idx)) return;

    try {
      const result = await withPollLock(interaction.message.id, async () => {
        const db = getDatabase();
        const poll: any = await db.findOne('polls', { message_id: interaction.message.id });
        if (!poll || poll.ended) return { ended: true as const };

        const options: PollOption[] = Array.isArray(poll.options) ? poll.options : [];
        if (idx < 0 || idx >= options.length) return { invalid: true as const };

        const uid = interaction.user.id;
        const alreadyHere = (options[idx].votes || []).includes(uid);

        for (const o of options) o.votes = (o.votes || []).filter(v => v !== uid);

        if (!alreadyHere) options[idx].votes.push(uid);

        await db.update('polls', { options }, { message_id: interaction.message.id });

        return { question: poll.question, options };
      });

      if ('ended' in result) {
        await interaction.reply({ content: 'This poll has ended.', flags: MessageFlags.Ephemeral });
        return;
      }
      if ('invalid' in result) {
        await interaction.deferUpdate();
        return;
      }

      await interaction.update({
        embeds: [buildPollEmbed(result.question, result.options)],
        components: buildPollButtons(result.options)
      });
    } catch {
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Could not register your vote.', flags: MessageFlags.Ephemeral });
        }
      } catch (error) {
          logger.debug('pollInteraction: suppressed error', error);
        }
    }
  }
};

export default event;
