// Shared, cached access to Discord's "/users/@me/guilds" endpoint.
//
// Discord rate-limits this endpoint much more aggressively than most others.
// Several parts of the dashboard (the guild picker, every settings API route's
// permission check, and the sign-in gate) each need the same data, and used
// to fetch it independently and uncached - enough parallel/rapid calls on the
// same token triggered 429s, which made permission checks fail closed and
// denied real admins. Centralizing the fetch behind one cache fixes both.

export interface DiscordUserGuild {
  id: string;
  owner: boolean;
  permissions: string;
  [key: string]: unknown;
}

const userGuildCache = new Map<string, { guilds: DiscordUserGuild[]; ts: number }>();
const userInflight = new Map<string, Promise<DiscordUserGuild[]>>();
const USER_CACHE_MS = 60_000;
const MAX_CACHED_TOKENS = 5000;

function pruneUserCache(now: number): void {
  for (const [token, entry] of userGuildCache) {
    if (now - entry.ts >= USER_CACHE_MS) userGuildCache.delete(token);
  }
  if (userGuildCache.size >= MAX_CACHED_TOKENS) userGuildCache.clear();
}

// Guilds the signed-in user belongs to, from their own OAuth token.
export async function fetchUserGuilds(accessToken: string): Promise<DiscordUserGuild[]> {
  const now = Date.now();
  pruneUserCache(now);

  const cached = userGuildCache.get(accessToken);
  if (cached && now - cached.ts < USER_CACHE_MS) return cached.guilds;

  const running = userInflight.get(accessToken);
  if (running) return running;

  const p = (async (): Promise<DiscordUserGuild[]> => {
    try {
      const res = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) {
        console.warn(`[discordGuildCache] /users/@me/guilds (user) -> HTTP ${res.status}`);
        if (cached) return cached.guilds;
        return [];
      }
      const guilds = (await res.json()) as DiscordUserGuild[];
      userGuildCache.set(accessToken, { guilds, ts: Date.now() });
      return guilds;
    } catch (err) {
      console.warn('[discordGuildCache] fetch user guilds failed:', err);
      if (cached) return cached.guilds;
      return [];
    } finally {
      userInflight.delete(accessToken);
    }
  })();

  userInflight.set(accessToken, p);
  return p;
}

const BOT_CACHE_MS = 5 * 60_000;
const BOT_RETRY_MS = 30_000;
let botGuildsCache: { guilds: DiscordUserGuild[]; expires: number } | null = null;
let botInflight: Promise<DiscordUserGuild[]> | null = null;

// Guilds the bot itself is a member of. Membership changes rarely, so this
// can be cached far longer than the per-user list.
export async function fetchBotGuilds(): Promise<DiscordUserGuild[]> {
  const now = Date.now();
  if (botGuildsCache && now < botGuildsCache.expires) return botGuildsCache.guilds;
  if (botInflight) return botInflight;

  const botToken = process.env.DISCORD_TOKEN;
  if (!botToken) return botGuildsCache?.guilds ?? [];

  botInflight = (async (): Promise<DiscordUserGuild[]> => {
    try {
      const res = await fetch('https://discord.com/api/v10/users/@me/guilds?limit=200', {
        headers: { Authorization: `Bot ${botToken}` }
      });
      if (!res.ok) {
        console.warn(`[discordGuildCache] /users/@me/guilds (bot) -> HTTP ${res.status}`);
        if (botGuildsCache) return botGuildsCache.guilds;
        botGuildsCache = { guilds: [], expires: now + BOT_RETRY_MS };
        return [];
      }
      const guilds = (await res.json()) as DiscordUserGuild[];
      botGuildsCache = { guilds, expires: Date.now() + BOT_CACHE_MS };
      return guilds;
    } catch (err) {
      console.warn('[discordGuildCache] fetch bot guilds failed:', err);
      if (botGuildsCache) return botGuildsCache.guilds;
      botGuildsCache = { guilds: [], expires: now + BOT_RETRY_MS };
      return [];
    } finally {
      botInflight = null;
    }
  })();

  return botInflight;
}

export async function fetchBotGuildIds(): Promise<Set<string>> {
  return new Set((await fetchBotGuilds()).map((g) => g.id));
}
