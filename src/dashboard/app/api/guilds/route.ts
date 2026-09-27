/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAppSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);

export async function GET(_request: NextRequest) {
  const session: any = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accessToken = session.accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: 'No Discord access token' }, { status: 403 });
  }

  try {
    const botToken = process.env.DISCORD_TOKEN;
    if (!botToken) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
    }

    const [botRes, userRes] = await Promise.all([
      fetch('https://discord.com/api/v10/users/@me/guilds?limit=200', {
        headers: { Authorization: `Bot ${botToken}` },
        cache: 'no-store',
      }),
      fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }),
    ]);

    if (!botRes.ok || !userRes.ok) {
      console.error('Failed to fetch guilds:', botRes.status, userRes.status);
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
    }

    const botGuilds = await botRes.json();
    const userGuilds = await userRes.json();
    if (!Array.isArray(botGuilds) || !Array.isArray(userGuilds)) {
      return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
    }

    const botGuildIds = new Set(botGuilds.map((g: any) => g.id));
    const manageable = userGuilds.filter((g: any) => {
      if (!botGuildIds.has(g.id)) return false;
      if (g.owner) return true;
      try {
        const permissions = BigInt(g.permissions || '0');
        return (permissions & ADMINISTRATOR) === ADMINISTRATOR || (permissions & MANAGE_GUILD) === MANAGE_GUILD;
      } catch {
        return false;
      }
    });

    return NextResponse.json(manageable, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Error fetching bot guilds:', error);
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } });
  }
}
