/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { UserData, GuildSettings } from '../../../../utils/models.js';
import { resolveEconomy } from '../../../../shared/featureConfig.js';
import { formatNumber, randomInt } from '../../../../utils/helpers.js';
import { getDatabase } from '../../../../utils/database.js';
import type { Command } from '../../../types.js';

const WORK_MESSAGES = [
  { job: 'Programmer', action: 'wrote code for a client' },
  { job: 'Youtuber', action: 'filmed a video' },
  { job: 'Streamer', action: 'streamoval 4 hodiny' },
  { job: 'Designer', action: 'vytvoril logo' },
  { job: 'Writer', action: 'wrote an article' },
  { job: 'Miner', action: 'mined crypto' },
  { job: 'Gamer', action: 'vyhral turnaj' },
  { job: 'Chef', action: 'cooked for a restaurant' },
  { job: 'Driver', action: 'delivered food' },
  { job: 'DJ', action: 'played at a party' },
  { job: 'Teacher', action: 'taught students' },
  { job: 'Artist', action: 'painted a picture' },
  { job: 'Photographer', action: 'fotil svadbu' },
  { job: 'Musician', action: 'hral na koncerte' },
  { job: 'Developer', action: 'fixed bugs in the app' }
];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work to earn money'),

  category: 'economy',
  guildOnly: true,
  cooldown: 5,

  execute: async (interaction: ChatInputCommandInteraction) => {
    const guildId = interaction.guildId!;
    const odId = interaction.user.id;

    const settings = await GuildSettings.findOne({ guildId });
    const economy = resolveEconomy(settings);
    const workCooldown = economy.workCooldown;
    const minReward = economy.workMinReward;
    const maxReward = economy.workMaxReward;
    const currencyName = economy.currencyName;
    const currencyEmoji = economy.currencyEmoji;

    let userData = await UserData.findOne({ odId, guildId });
    if (!userData) {
      userData = await UserData.create({ odId, guildId });
    }

    const lastWork = (userData as any).lastWork;
    const now = new Date();

    if (lastWork) {
      const timeSince = now.getTime() - lastWork.getTime();
      if (timeSince < workCooldown * 1000) {
        const timeLeft = Math.ceil((workCooldown * 1000 - timeSince) / 60000);
        await interaction.reply({
          embeds: [
            EmbedHelper.warning(
              '⏰ Cooldown',
              `You still need to wait **${timeLeft} minutes** before working again.`
            )
          ],
          flags: MessageFlags.Ephemeral
        });
        return;
      }
    }

    const reward = randomInt(minReward, maxReward);
    const workMessage = WORK_MESSAGES[Math.floor(Math.random() * WORK_MESSAGES.length)];

    await getDatabase().increment('user_data', { balance: reward }, {
      user_id: odId,
      guild_id: guildId
    });
    userData.balance += reward;
    (userData as any).lastWork = now;
    await userData.save();

    const embed = new EmbedBuilder()
      .setTitle(`💼 ${workMessage.job}`)
      .setDescription(
        `Pracoval si ako **${workMessage.job}** a ${workMessage.action}.\n\n` +
        `**Zarobil si:** ${currencyEmoji} ${formatNumber(reward)} ${currencyName}\n` +
        `**New balance:** ${currencyEmoji} ${formatNumber(userData.balance)} ${currencyName}`
      )
      .setColor('#57F287')
      .setFooter({ text: `Next work in ${Math.round(workCooldown / 60)} minutes` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};

export default command;
