import { NextResponse } from 'next/server';
import { getAppSession } from './auth';
import { ownerIdsFromEnv } from '../../shared/ownerCheck';
import { getDashboardSettings } from './guildSettings';
import { fetchUserGuilds } from './discordGuildCache';

const MANAGE_GUILD = BigInt(0x20);
const ADMINISTRATOR = BigInt(0x8);

export interface AuthResult {
  ok: boolean;
  response?: NextResponse;
  session?: any;
}

export async function verifyChannelInGuild(
  guildId: string,
  channelId: string,
  botToken: string
): Promise<boolean> {
  if (!channelId || !/^\d+$/.test(String(channelId))) return false;
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) return false;
    const channel: any = await res.json();
    return channel?.guild_id === guildId;
  } catch (err) {
    console.warn(`[guildAuth] verifyChannelInGuild failed for ${channelId}:`, err);
    return false;
  }
}

// Discord-level check only: guild owner, or Administrator/Manage Server permission.
// Used where the configured Manager role must NOT be enough (plugin management).
export async function requireGuildAdmin(guildId: string): Promise<AuthResult> {
  const session: any = await getAppSession();

  if (!session) {
    console.warn(`[guildAuth] deny ${guildId}: no session`);
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const accessToken = session.accessToken;
  if (!accessToken) {
    console.warn(`[guildAuth] deny ${guildId}: no accessToken in session`);
    return { ok: false, response: NextResponse.json({ error: 'No Discord access token' }, { status: 403 }) };
  }

  try {
    const guilds = await fetchUserGuilds(accessToken);
    const g = guilds.find((x) => x.id === guildId);
    let allowed = false;
    if (g) {
      if (g.owner === true) {
        allowed = true;
      } else {
        try {
          const perms = BigInt(g.permissions || '0');
          allowed = (perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & MANAGE_GUILD) === MANAGE_GUILD;
        } catch {
          allowed = false;
        }
      }
    }

    if (!allowed) {
      console.warn(`[guildAuth] deny ${guildId}: not a manager (found=${!!g})`);
      return { ok: false, response: NextResponse.json({ error: 'Forbidden - not a guild manager' }, { status: 403 }) };
    }
    return { ok: true, session };
  } catch (err) {
    console.warn(`[guildAuth] deny ${guildId}: check failed`, err);
    return { ok: false, response: NextResponse.json({ error: 'Authorization check failed' }, { status: 500 }) };
  }
}

async function hasManagerRole(guildId: string, userId: string | undefined): Promise<boolean> {
  if (!userId) return false;
  const roleId = String(getDashboardSettings(guildId)?.managerRoleId || '').trim();
  if (!roleId) return false;

  const botToken = process.env.DISCORD_TOKEN;
  if (!botToken) return false;

  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: { Authorization: `Bot ${botToken}` }
    });
    if (!res.ok) return false;
    const member: any = await res.json();
    return Array.isArray(member.roles) && member.roles.includes(roleId);
  } catch (err) {
    console.warn(`[guildAuth] manager role check failed for ${guildId}:`, err);
    return false;
  }
}

// Discord Admin/Manage Server, OR the guild's configured Manager role.
// The Manager role does NOT grant plugin management - use requireGuildAdmin there.
export async function requireGuildManager(guildId: string): Promise<AuthResult> {
  const admin = await requireGuildAdmin(guildId);
  if (admin.ok) return admin;

  const session: any = await getAppSession();
  if (session && (await hasManagerRole(guildId, session.user?.id))) {
    return { ok: true, session };
  }
  return admin;
}

export function botOwnerIds(): string[] {
  return ownerIdsFromEnv();
}

const OWNER_CACHE_MS = 10 * 60_000;
const OWNER_RETRY_MS = 60_000;
let applicationOwners: { ids: string[]; expires: number } | null = null;

export function resetOwnerCache(): void {
  applicationOwners = null;
}

async function applicationOwnerIds(): Promise<string[]> {
  const now = Date.now();
  if (applicationOwners && now < applicationOwners.expires) return applicationOwners.ids;

  const botToken = process.env.DISCORD_TOKEN;
  if (!botToken) return [];

  try {
    const res = await fetch('https://discord.com/api/v10/applications/@me', {
      headers: { Authorization: `Bot ${botToken}` }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const app: any = await res.json();
    const ids = new Set<string>();
    if (app?.team) {
      if (app.team.owner_user_id) ids.add(String(app.team.owner_user_id));
      for (const member of Array.isArray(app.team.members) ? app.team.members : []) {
        if (member?.role === 'admin' && member?.user?.id) ids.add(String(member.user.id));
      }
    } else if (app?.owner?.id) {
      ids.add(String(app.owner.id));
    }
    applicationOwners = { ids: [...ids], expires: now + OWNER_CACHE_MS };
    return applicationOwners.ids;
  } catch (err) {
    console.warn('[guildAuth] could not look up the application owner:', err);
    applicationOwners = { ids: [], expires: now + OWNER_RETRY_MS };
    return [];
  }
}

export async function botOwners(): Promise<string[]> {
  return Array.from(new Set([...botOwnerIds(), ...(await applicationOwnerIds())]));
}

export async function isBotOwner(userId: unknown): Promise<boolean> {
  if (typeof userId !== 'string' || userId.length === 0) return false;
  return (await botOwners()).includes(userId);
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function requireBotOwner(guildId: string, request: Request): Promise<AuthResult> {
  if (!sameOrigin(request)) {
    return { ok: false, response: NextResponse.json({ error: 'cross_origin' }, { status: 403 }) };
  }
  const auth = await requireGuildManager(guildId);
  if (!auth.ok) return auth;
  if (!(await isBotOwner(auth.session?.user?.id))) {
    return { ok: false, response: NextResponse.json({ error: 'not_owner' }, { status: 403 }) };
  }
  return auth;
}
