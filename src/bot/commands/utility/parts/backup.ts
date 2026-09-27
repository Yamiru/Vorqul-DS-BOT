/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel, VoiceChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { EmbedHelper } from '../../../../utils/embedHelper.js';
import { ChannelBackup } from '../../../../utils/models.js';
import config from '../../../../config/config.json' with { type: 'json' };
import type { Command } from '../../../types.js';
import { logger } from '../../../../utils/logger.js';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Backup and restore server channels')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a backup of all channels')
        .addStringOption(opt =>
          opt.setName('name').setDescription('Backup name').setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub.setName('list').setDescription('List all backups')
    )
    .addSubcommand(sub =>
      sub
        .setName('restore')
        .setDescription('Restore channels from backup')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Backup ID').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete a backup')
        .addStringOption(opt =>
          opt.setName('id').setDescription('Backup ID').setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'utility',
  guildOnly: true,
  permissions: [PermissionFlagsBits.Administrator],

  execute: async (interaction: ChatInputCommandInteraction) => {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const guild = interaction.guild!;

    switch (subcommand) {
      case 'create': {
        await interaction.deferReply();
        const backupName = interaction.options.getString('name') || `Backup ${new Date().toLocaleDateString()}`;

        const channels = guild.channels.cache
          .filter(channel => !channel.isThread())
          .map(channel => {
            const ch = channel as any;
            return {
              id: channel.id,
              name: channel.name,
              type: channel.type,
              position: ch.position ?? 0,
              parentId: channel.parentId,
              permissionOverwrites: ch.permissionOverwrites?.cache?.map((p: any) => ({
                id: p.id,
                type: p.type,
                allow: p.allow.bitfield.toString(),
                deny: p.deny.bitfield.toString()
              })) || [],
              topic: (channel as TextChannel).topic || null,
              nsfw: (channel as TextChannel).nsfw || false,
              rateLimitPerUser: (channel as TextChannel).rateLimitPerUser || 0,
              bitrate: (channel as VoiceChannel).bitrate || null,
              userLimit: (channel as VoiceChannel).userLimit || null
            };
          });

        const roles = guild.roles.cache.map(role => ({
          id: role.id,
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          position: role.position,
          permissions: role.permissions.bitfield.toString(),
          mentionable: role.mentionable
        }));

        const backup = await ChannelBackup.create({
          guildId,
          name: backupName,
          createdBy: interaction.user.id,
          channels,
          roles,
          serverName: guild.name,
          serverIcon: guild.iconURL()
        });

        await interaction.editReply({
          embeds: [
            EmbedHelper.success(
              '💾 Backup Created',
              `**Name:** ${backupName}\n**ID:** \`${backup._id}\`\n**Channels:** ${channels.length}\n**Roles:** ${roles.length}`
            )
          ]
        });
        break;
      }

      case 'list': {
        const allBackups = await ChannelBackup.find({ guildId });
        const backups = allBackups
          .sort((a: any, b: any) => new Date(b.createdAt || b.created_at).getTime() - new Date(a.createdAt || a.created_at).getTime())
          .slice(0, 10);

        if (backups.length === 0) {
          await interaction.reply({
            embeds: [EmbedHelper.info('Backups', 'No backups found.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('💾 Server Backups')
          .setColor(config.bot.embedColor as `#${string}`)
          .setDescription(
            backups.map((b: any, i: number) => {
              const timestamp = b.createdAt || b.created_at;
              const time = timestamp ? Math.floor(new Date(timestamp).getTime() / 1000) : 0;
              return `**${i + 1}.** ${b.name}\n` +
                `   ID: \`${b._id || b.id}\` | Created: <t:${time}:R>`;
            }).join('\n\n')
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'restore': {
        const backupId = interaction.options.getString('id', true);
        const backup = await ChannelBackup.findById(backupId);

        if (!backup || backup.guildId !== guildId) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Backup not found.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('backup_restore_confirm')
            .setLabel('Confirm Restore')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('backup_restore_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
          embeds: [
            EmbedHelper.warning(
              '⚠️ Confirm Restore',
              `This will attempt to recreate channels from backup **${backup.name}**.\n\nThis action cannot be undone!`
            )
          ],
          components: [row]
        });

        const response = await interaction.fetchReply();

        try {
          const confirmation = await response.awaitMessageComponent({
            filter: i => i.user.id === interaction.user.id,
            time: 30000
          });

          if (confirmation.customId === 'backup_restore_confirm') {
            await confirmation.update({
              embeds: [EmbedHelper.info('Restoring...', 'Please wait...')],
              components: []
            });

            let restored = 0;
            for (const channelData of backup.channels) {
              try {
                const options: any = {
                  name: channelData.name,
                  type: channelData.type,
                  position: channelData.position,
                  parent: channelData.parentId
                };

                if (channelData.topic) options.topic = channelData.topic;
                if (channelData.nsfw) options.nsfw = channelData.nsfw;
                if (channelData.rateLimitPerUser) options.rateLimitPerUser = channelData.rateLimitPerUser;
                if (channelData.bitrate) options.bitrate = channelData.bitrate;
                if (channelData.userLimit) options.userLimit = channelData.userLimit;

                await guild.channels.create(options);
                restored++;
              } catch (error) {
                  logger.debug('backup: suppressed error', error);
                }
            }

            await interaction.editReply({
              embeds: [
                EmbedHelper.success('✅ Restore Complete', `Restored ${restored}/${backup.channels.length} channels.`)
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
        const backupId = interaction.options.getString('id', true);
        const result = await ChannelBackup.findOneAndDelete({ _id: backupId, guildId });

        if (!result) {
          await interaction.reply({
            embeds: [EmbedHelper.error('Error', 'Backup not found.')],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        await interaction.reply({
          embeds: [EmbedHelper.success('Deleted', `Backup **${result.name}** deleted.`)]
        });
        break;
      }
    }
  }
};

export default command;
