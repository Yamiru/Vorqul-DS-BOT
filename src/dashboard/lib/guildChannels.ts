/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
export async function guildChannelTypes(guildId: string): Promise<Map<string, number> | null> {
  const botToken = process.env.DISCORD_TOKEN;
  if (!botToken) return null;
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${botToken}` }
    });
    if (!response.ok) return null;
    const channels = (await response.json()) as { id: string; type: number }[];
    return new Map(channels.map((channel) => [String(channel.id), Number(channel.type)]));
  } catch {
    return null;
  }
}
