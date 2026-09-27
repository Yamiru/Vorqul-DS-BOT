/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextResponse } from 'next/server';
import { translate, DEFAULT_LANGUAGE } from '@/lib/i18n';

function msg(key: string): string {
  return translate(key, DEFAULT_LANGUAGE);
}
import { getAppSession } from '@/lib/auth';
import { getDashboardSettings } from '@/lib/guildSettings';
import { fetchUserGuilds, fetchBotGuildIds } from '@/lib/discordGuildCache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);

export async function GET() {
  const session: any = await getAppSession();

  if (!session) {
    return NextResponse.json(
      { error: 'unauthenticated', message: msg('auth.notSignedIn') },
      { status: 401 }
    );
  }

  const accessToken = session.accessToken;
  if (!accessToken || session.expired) {
    return NextResponse.json(
      {
        error: 'token_expired',
        message: msg('auth.expired'),
      },
      { status: 401 }
    );
  }

  try {
    // Both lists are cached/deduped in discordGuildCache: Discord rate-limits
    // this endpoint hard, and every settings-page tab was calling it
    // independently, which used to trigger 429s and deny real admins.
    const guilds = await fetchUserGuilds(accessToken);
    const botGuildIdSet = await fetchBotGuildIds();

    const isDiscordAdmin = (guild: any) => {
      if (guild.owner) return true;
      try {
        const permissions = BigInt(guild.permissions || '0');
        return (
          (permissions & ADMINISTRATOR) === ADMINISTRATOR ||
          (permissions & MANAGE_GUILD) === MANAGE_GUILD
        );
      } catch {
        return false;
      }
    };

    const manageable = guilds.filter(isDiscordAdmin);
    const botGuildIds = [...botGuildIdSet];

    // Guilds not reachable via Discord Admin/Manage Server: still include them
    // if the signed-in user holds that guild's configured Manager role.
    const botToken = process.env.DISCORD_TOKEN;
    if (botToken) {
      const userId = (session.user as any)?.id;
      const candidates = guilds.filter((g) => !isDiscordAdmin(g) && botGuildIdSet.has(g.id));
      for (const guild of candidates) {
        const roleId = String(getDashboardSettings(guild.id)?.managerRoleId || '').trim();
        if (!roleId || !userId) continue;
        try {
          const memberRes = await fetch(`https://discord.com/api/v10/guilds/${guild.id}/members/${userId}`, {
            headers: { Authorization: `Bot ${botToken}` },
            cache: 'no-store'
          });
          if (!memberRes.ok) continue;
          const member: any = await memberRes.json();
          if (Array.isArray(member.roles) && member.roles.includes(roleId)) manageable.push(guild);
        } catch (error) {
          console.debug('route: manager role check suppressed error', error);
        }
      }
    }

    const result = manageable
      .map((guild: any) => ({
        id: guild.id,
        name: guild.name,
        icon: guild.icon,
        owner: guild.owner,
        permissions: guild.permissions,
        hasBot: botGuildIds.includes(guild.id),
      }))
      .sort((a: any, b: any) => {
        if (a.hasBot !== b.hasBot) return a.hasBot ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json(
      { guilds: result, total: guilds.length, manageable: result.length },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Failed to fetch user guilds:', error);
    return NextResponse.json(
      {
        error: 'network_error',
        message: msg('auth.unreachable'),
      },
      { status: 502 }
    );
  }
}
