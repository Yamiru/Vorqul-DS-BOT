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
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js';
import { EmbedHelper } from '../../../utils/embedHelper.js';
import { ConfigSnapshot, GuildSettings } from '../../../utils/models.js';
import { toStorageFormat } from '../../../shared/settingsSchema.js';
import { invalidateGuildCache } from '../../../utils/guildCache.js';
import config from '../../../config/config.json' with { type: 'json' };
import type { Command } from '../../types.js';

const SNAPSHOT_LIMIT = 20;

async function saveSnapshot(guildId: string, label: string, userId: string) {
  const current = await GuildSettings.findOne({ guildId }) || {};
  return ConfigSnapshot.create({ guildId, label, createdBy: userId, data: current });
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('snapshot')
    .setDescription('Backup and restore the server\'s bot configuration (modules, automod, welcome, etc.)')
    .addSubcommand(sub =>
      sub
        .setName('save')
        .setDescription('Save the current bot configuration as a snapshot')
        .addStringOption(opt =>
          opt.setName('label').setDescription('Snapshot label').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list').setDescription(`List saved configuration snapshots (max ${SNAPSHOT_LIMIT})`)
    )
    .addSubcommand(sub =>
      sub
        .setName('restore')
        .setDescription('Restore the bot configuration from a snapshot')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Snapshot ID').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete a configuration snapshot')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Snapshot ID').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'admin',
  guildOnly: true,
  permissions: [PermissionFlagsBits.Administrator],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    switch (subcommand) {
      case 'save': {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const label = interaction.options.getString('label') || `Snapshot ${new Date().toLocaleDateString()}`;

        const snapshot = await saveSnapshot(guildId, label, interaction.user.id);

        await interaction.editReply({
          embeds: [
            EmbedHelper.success(
              '📸 Snapshot Saved',
              `**Label:** ${label}\n**ID:** \`${snapshot._id}\`\n\nUse \`/snapshot restore id:${snapshot._id}\` to roll back to this configuration later.`
            )
          ]
        });
        break;
      }

      case 'list': {
        const snapshots = (await ConfigSnapshot.find({ guildId }))
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (snapshots.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Snapshots', 'No configuration snapshots found. Use `/snapshot save` to create one.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('📸 Configuration Snapshots')
          .setColor(config.bot.embedColor as `#${string}`)
          .setDescription(
            snapshots.map((s: any, i: number) => {
              const time = Math.floor(new Date(s.created_at).getTime() / 1000);
              return `**${i + 1}.** ${s.label}\n` +
                `   ID: \`${s._id}\` | By: <@${s.created_by}> | <t:${time}:R>`;
            }).join('\n\n')
          )
          .setFooter({ text: `${snapshots.length}/${SNAPSHOT_LIMIT} snapshots · oldest is dropped once the limit is hit` })
          .setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        break;
      }

      case 'restore': {
        const snapshotId = interaction.options.getString('id', true);
        const snapshot = await ConfigSnapshot.findById(snapshotId);

        if (!snapshot || snapshot.guild_id !== guildId) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Snapshot not found.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('snapshot_restore_confirm')
            .setLabel('Confirm Restore')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('snapshot_restore_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          embeds: [
            EmbedHelper.warning(
              '⚠️ Confirm Restore',
              `This will overwrite the server's **entire bot configuration** (modules, automod, welcome, economy, etc.) with snapshot **${snapshot.label}**.\n\n` +
              `A safety snapshot of the current configuration is saved automatically before restoring, so this can be undone.`
            )
          ],
          components: [row],
          flags: MessageFlags.Ephemeral
        });

        const response = await interaction.fetchReply();

        try {
          const confirmation = await response.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id,
            time: 30000
          });

          if (confirmation.customId === 'snapshot_restore_confirm') {
            await confirmation.update({
              embeds: [EmbedHelper.info('Restoring...', 'Please wait...')],
              components: []
            });

            await saveSnapshot(guildId, `Auto-backup before restoring "${snapshot.label}"`, interaction.user.id);

            const stored = toStorageFormat(guildId, snapshot.data || {});
            await GuildSettings.updateOne({ guildId }, { $set: stored }, { upsert: true });
            invalidateGuildCache();

            await interaction.editReply({
              embeds: [
                EmbedHelper.success('✅ Restore Complete', `Configuration restored from **${snapshot.label}**.`)
              ]
            });
          } else {
            await confirmation.update({
              embeds: [EmbedHelper.info('Cancelled', 'Restore cancelled.')],
              components: []
            });
          }
        } catch {
          await interaction.editReply({
            embeds: [EmbedHelper.info('Timeout', 'Restore cancelled due to timeout.')],
            components: []
          });
        }
        break;
      }

      case 'delete': {
        const snapshotId = interaction.options.getString('id', true);
        const result = await ConfigSnapshot.findOneAndDelete({ _id: snapshotId, guildId });

        if (!result) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Snapshot not found.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.reply({
          embeds: [EmbedHelper.success('Deleted', `Snapshot **${result.label}** deleted.`)],
          flags: MessageFlags.Ephemeral
        });
        break;
      }
    }
  }
};

export default command;
