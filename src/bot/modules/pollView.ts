/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export interface PollOption { text: string; votes: string[]; }

export const POLL_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function bar(pct: number): string {
  const filled = Math.round(pct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

export function buildPollEmbed(
  question: string,
  options: PollOption[],
  opts: { ended?: boolean; authorName?: string; color?: number } = {}
): EmbedBuilder {
  const total = options.reduce((s, o) => s + (o.votes?.length || 0), 0);
  const maxVotes = Math.max(0, ...options.map(o => o.votes?.length || 0));

  const lines = options.map((o, i) => {
    const v = o.votes?.length || 0;
    const pct = total ? Math.round((v / total) * 100) : 0;
    const lead = opts.ended && v === maxVotes && maxVotes > 0 ? ' 👑' : '';
    return `${POLL_EMOJIS[i]} **${o.text}**${lead}\n\`${bar(pct)}\` ${pct}% · ${v} vote${v === 1 ? '' : 's'}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${question}`)
    .setDescription(lines.join('\n\n'))
    .setColor(opts.color ?? (opts.ended ? 0xfee75c : 0x5865f2))
    .setFooter({
      text: `${total} vote${total === 1 ? '' : 's'}` +
        (opts.ended ? ' • Poll ended' : ' • Click a button to vote') +
        (opts.authorName ? ` • by ${opts.authorName}` : '')
    });

  return embed;
}

export function buildPollButtons(options: PollOption[], disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let row = new ActionRowBuilder<ButtonBuilder>();
  options.forEach((_, i) => {
    if (i > 0 && i % 5 === 0) { rows.push(row); row = new ActionRowBuilder<ButtonBuilder>(); }
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`poll_vote_${i}`)
        .setEmoji(POLL_EMOJIS[i])
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    );
  });
  rows.push(row);
  return rows;
}
