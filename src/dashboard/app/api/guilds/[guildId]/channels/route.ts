/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireGuildManager } from '@/lib/guildAuth';

export async function GET(request: NextRequest, props: { params: Promise<{ guildId: string }> }) {
  const params = await props.params;
  const __auth = await requireGuildManager(params.guildId);
  if (!__auth.ok) return __auth.response!;

  try {
    const { guildId } = params;
    const botToken = process.env.DISCORD_TOKEN;

    if (!botToken) {
      console.error('Bot token not configured');
      return NextResponse.json([]);
    }

    const response = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch channels:', response.status);
      return NextResponse.json([]);
    }

    const channels = await response.json();

    const formattedChannels = channels.map((channel: any) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      position: channel.position,
      parentId: channel.parent_id
    })).sort((a: any, b: any) => a.position - b.position);

    return NextResponse.json(formattedChannels);
  } catch (error) {
    console.error('Error fetching channels:', error);
    return NextResponse.json([]);
  }
}
