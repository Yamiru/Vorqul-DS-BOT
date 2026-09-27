/*!
 * Vorqul DS BOT
 * https://github.com/Yamiru/Vorqul-DS-BOT
 *
 * Copyright (c) Yamiru. All rights reserved.
 * Licensed under the Vorqul DS BOT License - see LICENSE for terms.
 */
import { NextAuthOptions, getServerSession } from 'next-auth';
import { headers } from 'next/headers';
import { requestIsHttps } from './requestProtocol';
import DiscordProvider from 'next-auth/providers/discord';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getDashboardSettings } from './guildSettings';
import { fetchUserGuilds, fetchBotGuildIds } from './discordGuildCache';

const MANAGE_GUILD = BigInt(0x20);
const ADMINISTRATOR = BigInt(0x8);

function ownerAllowlists(): { emails: string[]; ids: string[] } {
  return {
    emails: (process.env.ALLOWED_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    ids: (process.env.ALLOWED_IDS || '').split(',').map((id) => id.trim()).filter(Boolean)
  };
}

// True when either allowlist is configured and this user is on it (or neither
// list is configured, meaning the dashboard isn't restricted at all). Guild
// managers let in only via hasAnyManagedGuild are NOT owner-tier: they can
// run their own server, but not invite the bot to new ones or bypass the
// dashboard's owner restriction elsewhere.
export function isOwnerTier(userId: string | undefined | null, email: string | undefined | null): boolean {
  const { emails, ids } = ownerAllowlists();
  if (emails.length === 0 && ids.length === 0) return true;
  const normEmail = (email || '').toLowerCase().trim();
  return (!!normEmail && emails.includes(normEmail)) || (!!userId && ids.includes(userId));
}

export function dashboardIsRestricted(): boolean {
  const { emails, ids } = ownerAllowlists();
  return emails.length > 0 || ids.length > 0;
}

// Used when ALLOWED_EMAILS/ALLOWED_IDS restricts the dashboard: someone
// outside those lists is still let in if they hold Admin/Manage Server or the
// configured Manager role in at least one guild the BOT IS ACTUALLY IN - never
// based on a server of theirs the bot has nothing to do with. Owning some
// unrelated Discord server does not count.
async function hasAnyManagedGuild(userId: string, accessToken: string): Promise<boolean> {
  const botToken = process.env.DISCORD_TOKEN;
  if (!botToken) return false;

  try {
    const [userGuilds, botGuildIds] = await Promise.all([
      fetchUserGuilds(accessToken),
      fetchBotGuildIds()
    ]);

    const sharedGuilds = userGuilds.filter((g) => botGuildIds.has(g.id));

    for (const g of sharedGuilds) {
      if (g.owner === true) return true;
      try {
        const perms = BigInt(g.permissions || '0');
        if ((perms & ADMINISTRATOR) === ADMINISTRATOR || (perms & MANAGE_GUILD) === MANAGE_GUILD) return true;
      } catch {
        // ignore malformed permission strings
      }

      const roleId = String(getDashboardSettings(g.id)?.managerRoleId || '').trim();
      if (!roleId) continue;

      try {
        const memberRes = await fetch(`https://discord.com/api/v10/guilds/${g.id}/members/${userId}`, {
          headers: { Authorization: `Bot ${botToken}` }
        });
        if (!memberRes.ok) continue;
        const member: any = await memberRes.json();
        if (Array.isArray(member.roles) && member.roles.includes(roleId)) return true;
      } catch {
        // guild not reachable with the bot token, skip
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Memoized per process: getAuthOptions() (and therefore this) is called fresh
// on every getAppSession(), and Next.js also loads this module separately per
// route bundle. Without caching, a transient fs hiccup or a startup race
// between bundles could hand out two different secrets, so a session cookie
// encrypted by one route fails JWT decryption when read by another
// (JWT_SESSION_ERROR / "decryption operation failed").
let cachedSecret: string | null = null;

const getSecret = (): string => {
  if (cachedSecret) return cachedSecret;

  if (process.env.NEXTAUTH_SECRET) {
    cachedSecret = process.env.NEXTAUTH_SECRET.trim();
    return cachedSecret;
  }

  try {
    const dir = path.join(process.env.DATA_PATH || './data', 'secrets');
    const file = path.join(dir, 'nextauth_secret');
    if (fs.existsSync(file)) {
      const v = fs.readFileSync(file, 'utf-8').trim();
      if (v) {
        cachedSecret = v;
        return cachedSecret;
      }
    }
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const generated = crypto.randomBytes(32).toString('hex');
    try {
      // Exclusive create: if another process/bundle wins this race, fall
      // through to the catch and read back whatever it wrote instead of
      // using our own locally-generated value.
      fs.writeFileSync(file, generated, { encoding: 'utf-8', mode: 0o600, flag: 'wx' });
      cachedSecret = generated;
    } catch {
      cachedSecret = fs.readFileSync(file, 'utf-8').trim() || generated;
    }
    console.warn('[auth] NEXTAUTH_SECRET is not set - a random secret was written to data/secrets/. Set NEXTAUTH_SECRET in production.');
    return cachedSecret;
  } catch {
    if (!cachedSecret) cachedSecret = crypto.randomBytes(32).toString('hex');
    return cachedSecret;
  }
};

export const getAuthOptions = (useSecureCookies?: boolean): NextAuthOptions => ({
  ...(useSecureCookies === undefined ? {} : { useSecureCookies }),
  providers: [
    DiscordProvider({
      clientId: (process.env.DISCORD_CLIENT_ID || '').trim(),
      clientSecret: (process.env.DISCORD_CLIENT_SECRET || '').trim(),
      authorization: {
        params: {
          scope: 'identify email guilds',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!dashboardIsRestricted()) return true;

      const userId = (profile as any)?.id;
      const email = (user?.email || (profile as any)?.email) as string | undefined;

      if ((profile as any)?.verified === false) return false;
      if (isOwnerTier(userId, email)) return true;

      // Not on either owner allowlist - still let them in if they manage at
      // least one guild (Admin/Manage Server, or the configured Manager
      // role). Every guild route re-checks this, so they only ever reach
      // guilds they run.
      const accessToken = account?.access_token;
      if (userId && accessToken && (await hasAnyManagedGuild(userId, accessToken))) return true;

      return false;
    },
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.id = (profile as any)?.id;

        token.expiresAt = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 7 * 24 * 60 * 60 * 1000;
      }

      if (typeof token.expiresAt === 'number' && Date.now() >= token.expiresAt) {
        token.expired = true;
      }

      token.isOwnerTier = isOwnerTier(token.id as string | undefined, token.email as string | undefined);

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session as any).accessToken = token.accessToken;
        (session as any).expiresAt = token.expiresAt;
        (session as any).expired = token.expired === true;
        (session as any).isOwnerTier = token.isOwnerTier !== false;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: getSecret(),
});

export const authOptions: NextAuthOptions = getAuthOptions();

export async function getAppSession() {
  const h = await headers();
  return getServerSession(getAuthOptions(requestIsHttps(h)));
}
