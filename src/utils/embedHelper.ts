/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { EmbedBuilder, ColorResolvable, APIEmbedField } from 'discord.js';
import config from '../config/config.json' with { type: 'json' };
import { brand } from '../shared/brand.js';

export interface EmbedTemplate {
  id: string;
  name: string;
  title?: string;
  description?: string;
  color?: string;
  thumbnail?: string;
  image?: string;
  footer?: string;
  fields?: APIEmbedField[];
  timestamp?: boolean;
  author?: {
    name: string;
    iconUrl?: string;
    url?: string;
  };
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function clampEmbedFields(fields?: APIEmbedField[]): APIEmbedField[] | undefined {
  if (!fields) return fields;
  return fields.slice(0, 25).map(f => ({
    name: truncate(String(f.name ?? ''), 256) || '​',
    value: truncate(String(f.value ?? ''), 1024) || '​',
    inline: f.inline
  }));
}

function brandFooter(): string {
  return process.env.VORQUL_TAMPERED === '1' ? `${brand.footer} • modified build` : brand.footer;
}

export class EmbedHelper {
  static success(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`✅ ${title}`)
      .setColor(config.bot.successColor as ColorResolvable)
      .setFooter({ text: brandFooter() })
      .setTimestamp();

    if (description) embed.setDescription(description);
    return embed;
  }

  static error(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`❌ ${title}`)
      .setColor(config.bot.errorColor as ColorResolvable)
      .setFooter({ text: brandFooter() })
      .setTimestamp();

    if (description) embed.setDescription(description);
    return embed;
  }

  static warning(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`⚠️ ${title}`)
      .setColor(config.bot.warningColor as ColorResolvable)
      .setFooter({ text: brandFooter() })
      .setTimestamp();

    if (description) embed.setDescription(description);
    return embed;
  }

  static info(title: string, description?: string): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`ℹ️ ${title}`)
      .setColor(config.bot.embedColor as ColorResolvable)
      .setFooter({ text: brandFooter() })
      .setTimestamp();

    if (description) embed.setDescription(description);
    return embed;
  }

  static custom(options: {
    title?: string;
    description?: string;
    color?: ColorResolvable;
    thumbnail?: string;
    image?: string;
    footer?: string;
    fields?: APIEmbedField[];
    timestamp?: boolean;
    author?: { name: string; iconUrl?: string; url?: string };
  }): EmbedBuilder {
    const embed = new EmbedBuilder();

    if (options.title) embed.setTitle(truncate(options.title, 256));
    if (options.description) embed.setDescription(truncate(options.description, 4096));
    if (options.color) embed.setColor(options.color);
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);
    embed.setFooter({ text: truncate(options.footer || brandFooter(), 2048) });
    const fields = clampEmbedFields(options.fields);
    if (fields) embed.addFields(fields);
    if (options.timestamp) embed.setTimestamp();
    if (options.author) {
      embed.setAuthor({
        name: truncate(options.author.name, 256),
        iconURL: options.author.iconUrl,
        url: options.author.url
      });
    }

    return embed;
  }

  static fromTemplate(template: EmbedTemplate, replacements?: Record<string, string>): EmbedBuilder {
    let title = template.title || '';
    let description = template.description || '';
    let footer = template.footer || '';

    if (replacements) {
      for (const [key, value] of Object.entries(replacements)) {
        const pattern = new RegExp(`\\{${key}\\}`, 'g');
        title = title.replace(pattern, () => value);
        description = description.replace(pattern, () => value);
        footer = footer.replace(pattern, () => value);
      }
    }

    return this.custom({
      title,
      description,
      color: (template.color || config.bot.embedColor) as ColorResolvable,
      thumbnail: template.thumbnail,
      image: template.image,
      footer,
      fields: template.fields,
      timestamp: template.timestamp,
      author: template.author
    });
  }
}

export default EmbedHelper;
