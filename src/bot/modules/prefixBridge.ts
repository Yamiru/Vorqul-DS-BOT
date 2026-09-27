/*!
 * Vorqul DS BOT - Prefix Bridge
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import {
  Message,
  Client,
  EmbedBuilder,
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  GuildMember,
  User,
  Role,
  Attachment,
} from 'discord.js';
import type { Command } from '../types.js';
import { suppress } from '../../utils/suppress.js';

interface OptionDef {
  name: string;
  type: number;
  required?: boolean;
  options?: OptionDef[];
}

export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return tokens;
}

function extractId(raw: string): string | null {
  const mention = raw.match(/^<(?:@[!&]?|#)(\d{15,20})>$/);
  if (mention) return mention[1];
  if (/^\d{15,20}$/.test(raw)) return raw;
  return null;
}

function parseBoolean(raw: string): boolean | null {
  const value = raw.toLowerCase();
  if (['true', 'yes', 'y', '1', 'ano', 'áno', 'on'].includes(value)) return true;
  if (['false', 'no', 'n', '0', 'nie', 'off'].includes(value)) return false;
  return null;
}

function mapTokensToOptions(
  tokens: string[],
  defs: OptionDef[]
): Map<string, string> {
  const values = new Map<string, string>();
  const positional: string[] = [];
  const byName = new Map(defs.map((d) => [d.name.toLowerCase(), d]));

  for (const token of tokens) {
    const named = token.match(/^([a-z0-9_-]+):(.*)$/i);
    if (named && byName.has(named[1].toLowerCase()) && named[2].length > 0) {
      values.set(named[1].toLowerCase(), named[2]);
    } else {
      positional.push(token);
    }
  }

  const remaining = defs.filter((d) => !values.has(d.name.toLowerCase()));

  for (let i = 0; i < remaining.length && positional.length > 0; i++) {
    const def = remaining[i];
    const isLast = i === remaining.length - 1;
    const isText = def.type === ApplicationCommandOptionType.String;

    if (isLast && isText) {
      values.set(def.name.toLowerCase(), positional.join(' '));
      positional.length = 0;
    } else {
      values.set(def.name.toLowerCase(), positional.shift()!);
    }
  }

  return values;
}

class PrefixOptions {
  constructor(
    private readonly message: Message,
    private readonly values: Map<string, string>,
    private readonly defs: OptionDef[],
    private readonly subcommand: string | null,
    private readonly subcommandGroup: string | null
  ) {}

  private raw(name: string): string | null {
    return this.values.get(name.toLowerCase()) ?? null;
  }

  private missing(name: string, required?: boolean): null {
    if (required) throw new PrefixArgumentError(name);
    return null;
  }

  getSubcommand(required = true): string {
    if (!this.subcommand && required) {
      throw new PrefixArgumentError('subcommand');
    }
    return this.subcommand as string;
  }

  getSubcommandGroup(required = false): string | null {
    if (!this.subcommandGroup && required) {
      throw new PrefixArgumentError('subcommand group');
    }
    return this.subcommandGroup;
  }

  getString(name: string, required?: boolean): string | null {
    const value = this.raw(name);
    return value === null ? this.missing(name, required) : value;
  }

  getInteger(name: string, required?: boolean): number | null {
    const value = this.raw(name);
    if (value === null) return this.missing(name, required);
    const parsed = parseInt(value.replace(/[\s_]/g, ''), 10);
    return Number.isNaN(parsed) ? this.missing(name, required) : parsed;
  }

  getNumber(name: string, required?: boolean): number | null {
    const value = this.raw(name);
    if (value === null) return this.missing(name, required);
    const parsed = parseFloat(value.replace(',', '.'));
    return Number.isNaN(parsed) ? this.missing(name, required) : parsed;
  }

  getBoolean(name: string, required?: boolean): boolean | null {
    const value = this.raw(name);
    if (value === null) return this.missing(name, required);
    const parsed = parseBoolean(value);
    return parsed === null ? this.missing(name, required) : parsed;
  }

  getUser(name: string, required?: boolean): User | null {
    const value = this.raw(name);
    if (value === null) return this.missing(name, required);

    const id = extractId(value);
    if (id) {
      const cached = this.message.client.users.cache.get(id);
      if (cached) return cached;
    }

    const needle = value.toLowerCase();
    const member = this.message.guild?.members.cache.find(
      (m) =>
        m.user.username.toLowerCase() === needle ||
        m.user.tag.toLowerCase() === needle ||
        m.displayName.toLowerCase() === needle
    );
    if (member) return member.user;

    return this.missing(name, required);
  }

  getMember(name: string): GuildMember | null {
    const value = this.raw(name);
    if (value === null) return null;

    const id = extractId(value);
    if (id) {
      const cached = this.message.guild?.members.cache.get(id);
      if (cached) return cached;
    }

    const needle = value.toLowerCase();
    return (
      this.message.guild?.members.cache.find(
        (m) =>
          m.user.username.toLowerCase() === needle ||
          m.displayName.toLowerCase() === needle
      ) || null
    );
  }

  getChannel(name: string, required?: boolean): any {
    const value = this.raw(name);
    if (value === null) return this.missing(name, required);

    const id = extractId(value);
    if (id) {
      const cached = this.message.guild?.channels.cache.get(id);
      if (cached) return cached;
    }

    const needle = value.replace(/^#/, '').toLowerCase();
    const channel = this.message.guild?.channels.cache.find(
      (c) => c.name.toLowerCase() === needle
    );
    return channel || this.missing(name, required);
  }

  getRole(name: string, required?: boolean): Role | null {
    const value = this.raw(name);
    if (value === null) return this.missing(name, required);

    const id = extractId(value);
    if (id) {
      const cached = this.message.guild?.roles.cache.get(id);
      if (cached) return cached;
    }

    const needle = value.replace(/^@/, '').toLowerCase();
    const role = this.message.guild?.roles.cache.find(
      (r) => r.name.toLowerCase() === needle
    );
    return role || this.missing(name, required);
  }

  getMentionable(name: string, required?: boolean): any {
    return this.getUser(name) || this.getRole(name, required);
  }

  getAttachment(name: string, required?: boolean): Attachment | null {
    const attachment = this.message.attachments.first();
    return attachment || this.missing(name, required);
  }

  getFocused(): string {
    return '';
  }

  get data(): OptionDef[] {
    return this.defs;
  }
}

export class PrefixArgumentError extends Error {
  constructor(public readonly optionName: string) {
    super(`Chýba povinný argument: ${optionName}`);
    this.name = 'PrefixArgumentError';
  }
}

export class PrefixUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrefixUnsupportedError';
  }
}

function stripEphemeral(payload: any): any {
  if (typeof payload === 'string') return { content: payload };
  if (!payload || typeof payload !== 'object') return { content: String(payload) };

  const { ephemeral, flags, fetchReply, withResponse, ...rest } = payload;
  return rest;
}

export function buildPrefixInteraction(
  client: Client,
  message: Message,
  command: Command,
  tokens: string[]
): ChatInputCommandInteraction {
  const json: any = command.data.toJSON();
  const topLevel: OptionDef[] = json.options || [];

  let subcommandGroup: string | null = null;
  let subcommand: string | null = null;
  let optionDefs: OptionDef[] = topLevel;
  const argTokens = [...tokens];

  const hasGroups = topLevel.some(
    (o) => o.type === ApplicationCommandOptionType.SubcommandGroup
  );
  const hasSubs = topLevel.some(
    (o) => o.type === ApplicationCommandOptionType.Subcommand
  );

  if (hasGroups || hasSubs) {
    const first = (argTokens[0] || '').toLowerCase();
    const groupDef = topLevel.find(
      (o) => o.type === ApplicationCommandOptionType.SubcommandGroup && o.name === first
    );

    if (groupDef) {
      subcommandGroup = groupDef.name;
      argTokens.shift();
      const second = (argTokens[0] || '').toLowerCase();
      const subDef = (groupDef.options || []).find((o) => o.name === second);
      if (subDef) {
        subcommand = subDef.name;
        argTokens.shift();
        optionDefs = subDef.options || [];
      } else {
        optionDefs = [];
      }
    } else {
      const subDef = topLevel.find(
        (o) => o.type === ApplicationCommandOptionType.Subcommand && o.name === first
      );
      if (subDef) {
        subcommand = subDef.name;
        argTokens.shift();
        optionDefs = subDef.options || [];
      } else {
        optionDefs = [];
      }
    }
  }

  const values = mapTokensToOptions(argTokens, optionDefs);
  const options = new PrefixOptions(message, values, optionDefs, subcommand, subcommandGroup);

  let replyMessage: Message | null = null;
  let replied = false;
  let deferred = false;

  const send = async (payload: any): Promise<Message> => {
    const clean = stripEphemeral(payload);
    if (!clean.content && !clean.embeds?.length && !clean.files?.length) {
      clean.content = '\u200b';
    }
    return message.reply({ ...clean, allowedMentions: { repliedUser: false } });
  };

  const proxy: any = {
    commandName: command.data.name,
    id: message.id,
    createdTimestamp: message.createdTimestamp,
    locale: 'en-US',
    client,

    guild: message.guild,
    guildId: message.guildId,
    channel: message.channel,
    channelId: message.channelId,
    user: message.author,
    member: message.member,
    memberPermissions: message.member?.permissions ?? null,
    appPermissions: message.guild?.members.me?.permissions ?? null,

    options,

    get replied() {
      return replied;
    },
    get deferred() {
      return deferred;
    },
    isChatInputCommand: () => true,
    isCommand: () => true,
    isAutocomplete: () => false,
    inGuild: () => Boolean(message.guildId),
    inCachedGuild: () => Boolean(message.guild),

    async reply(payload: any) {
      replyMessage = await send(payload);
      replied = true;
      return replyMessage;
    },

    async deferReply() {
      deferred = true;
      if ('sendTyping' in message.channel) {
        await (message.channel as any).sendTyping().catch(suppress('prefixBridge'));
      }
      return undefined;
    },

    async editReply(payload: any) {
      if (replyMessage) {
        const clean = stripEphemeral(payload);
        replyMessage = await replyMessage.edit(clean);
      } else {
        replyMessage = await send(payload);
      }
      replied = true;
      deferred = false;
      return replyMessage;
    },

    async followUp(payload: any) {
      return send(payload);
    },

    async fetchReply() {
      return replyMessage;
    },

    async deleteReply() {
      if (replyMessage) {
        await replyMessage.delete().catch(suppress('prefixBridge'));
        replyMessage = null;
      }
    },

    async showModal() {
      throw new PrefixUnsupportedError(
        'Tento príkaz otvára formulár, ktorý sa dá zobraziť len cez lomítkovú verziu.'
      );
    },
    async respond() {
    },
  };

  return proxy as ChatInputCommandInteraction;
}

export function usageHint(command: Command, prefix: string): string {
  const json: any = command.data.toJSON();
  const options: OptionDef[] = json.options || [];

  const subs = options.filter(
    (o) =>
      o.type === ApplicationCommandOptionType.Subcommand ||
      o.type === ApplicationCommandOptionType.SubcommandGroup
  );

  if (subs.length > 0) {
    return `${prefix}${json.name} <${subs.map((s) => s.name).join(' | ')}>`;
  }

  const args = options
    .map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`))
    .join(' ');

  return `${prefix}${json.name}${args ? ' ' + args : ''}`;
}

export function argumentErrorEmbed(
  error: PrefixArgumentError,
  command: Command,
  prefix: string
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('Chýbajúci argument')
    .setDescription(
      `Argument \`${error.optionName}\` je povinný.\n\n` +
        `**Použitie:** \`${usageHint(command, prefix)}\``
    );
}
