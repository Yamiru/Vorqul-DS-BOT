# Vorqul DS BOT

![License](https://img.shields.io/badge/license-Proprietary-orange.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![Discord.js](https://img.shields.io/badge/discord.js-v14-blue.svg)
![Dashboard](https://img.shields.io/badge/dashboard-Next.js%2015-black.svg)

> **Website:** https://vorqul.com

<p align="center">
  <img src="https://i.imgur.com/aeEE972.png" width="200" alt="Vorqul DS BOT screenshot 1">
  <img src="https://i.imgur.com/YRCuAky.png" width="200" alt="Vorqul DS BOT screenshot 2">
  <img src="https://i.imgur.com/q5phPPO.png" width="200" alt="Vorqul DS BOT screenshot 3">
  <img src="https://i.imgur.com/3mmC7zA.png" width="200" alt="Vorqul DS BOT screenshot 4">
</p>

A self-hosted Discord bot with an optional web dashboard. It does the usual heavy
lifting: moderation, auto-mod, leveling, economy, tickets, welcome cards. But
the thing I actually built it for is the **Server Health Score**, one number
that tells you whether your community is growing, coasting, or quietly dying,
based on activity, retention and member churn. Most bots show you stats. This
one tells you what they mean.

## Discord Demo and Support
**[https://discord.gg/jNVwwcQ](https://discord.gg/jNVwwcQ)**

## Why this exists

I run a few gaming communities and got tired of stitching together five
different bots (one for moderation, one for levels, another for tickets),
each with its own dashboard, its own quirks, its own monthly bill. Vorqul DS
BOT is the all-in-one I wanted: self-hosted, no premium paywall on the
features you actually need, and a
dashboard that doesn't get in the way. If it saves you the same hassle, good.

## Features

The bot ships **83 slash commands** (every one also works with the `!` text
prefix) organized into **44 toggleable modules**, each independently
configurable from the dashboard or from Discord. Every module can also be
scoped to specific channels, from the dashboard or with `/channels`.

**Moderation & safety**
- Core actions: kick, ban, unban, softban, tempban, timeout, untimeout, mute,
  unmute, voice-mute, warn, note/notes, case history, clear/cleanup, jail/unjail,
  shadow-mute, lock/unlock/lockdown, slowmode, mass-nick, mass-role, permission
  check, alt-account detection, appeals
- **AutoMod**: spam, links, invites, caps, mass mentions, word blacklist,
  repeated text, excessive emoji/spoilers, zalgo text, phishing/lookalike
  domains, fake-Nitro links, crypto-scam patterns, custom regex rules, precise
  mass-mention counting and ghost-ping detection, each with its own action and
  threshold
- **Anti-Nuke**: watches channel/role delete-or-create, bans, kicks, webhook
  creation and mass role handouts, then punishes the offending account
  automatically (strip roles, kick or ban), with an owner and whitelist
  exemption
- **Anti-Raid**: detects join surges and auto-locks the server, plus a minimum
  account-age gate (kick, ban, timeout, quarantine role or log-only), with a
  pre-action DM to the rejected user
- **Verification**: button, reaction or captcha gate before new members can see
  the rest of the server
- **Extended audit logging**: messages, members, roles, channels, threads,
  invites, emojis, stickers, server boosts, bans/unbans, routed per category
  to their own log channel with a sane fallback chain
- **Role persistence**: gives a returning member back the roles they had before
  leaving
- **Name history**: tracks nickname and username changes

**Members & roles**
- Welcome, goodbye and welcome-DM messages, plain text or embed, with live
  image welcome cards, variables and a saved-message library
- Auto-roles on join, reaction roles (buttons or dropdown menus, single- or
  multi-choice), role menus, temp/timed roles that expire on their own
- Invite tracking with an invite leaderboard

**Engagement**
- XP/leveling with role rewards, rank cards, voice XP and leaderboards
- Reputation (`/rep give|remove|check|leaderboard`) with cooldowns and an
  optional reward role
- Counting game with goals, a reward role and a persistent high score
- Birthdays: `/birthday set|view|list|remove`, a daily announcer and an
  optional role removed the next day
- Anonymous confessions with optional anonymous replies and a staff log
- Starboard, suggestions (with voting), live-button polls (auto-closing, with
  a winner crown)

**Economy & games**
- Economy: balance, daily streak, work, pay/transfer, bank (deposit/withdraw,
  theft-proof), shop, player-to-player market, lootboxes, wheel spin, rob, and
  `/economy heist`, a button-based group robbery with balances re-checked right
  before it runs
- Casino: slots and interactive blackjack
- Ten independently-toggleable games: tic-tac-toe, Connect Four,
  rock-paper-scissors, trivia/quiz, dice, coin flip, magic 8-ball, matchmaking
  (find teammates), daily/weekly quests, and a game-stats leaderboard
- Giveaways with multiple winners, bonus-entry roles and reroll

**Content & community tools**
- Tickets with categories, staff claiming and transcripts
- Applications: a modal-based form posted for staff review, with an
  auto-granted role on acceptance
- Auto-responses to keywords/FAQs
- Sticky messages pinned to the bottom of a channel
- Tags: self-assignable roles by category, plus saved text replies
- RSS feeds and social-account watchers (YouTube, Twitch) posted straight to a
  channel
- Reminders (`/tools reminder`)

**Utility & tools**
- Server info, user info, avatar, member count, invite tracking, "what did I
  miss" and "why was I banned" lookups
- AFK status with automatic return detection
- Temporary voice channels created on demand
- Voice-time and message-count stats with leaderboards
- Game-server status monitoring (e.g. Minecraft)
- Crypto prices and price alerts
- Structured channel/role backup and restore (`/backup`)
- **Configuration snapshots** (`/snapshot`): save the server's entire bot
  configuration (modules, automod, welcome, economy, everything) and roll it
  back later. Restoring auto-saves a safety snapshot first, so a bad settings
  change is never a dead end
- Outgoing webhooks (HMAC-signed) for your own integrations
- Prefix-command support: every slash command also works with `!`

**Web dashboard (optional)**
- Discord OAuth2 login with an e-mail allowlist, plus an optional shared
  password gate in front of the entire dashboard
- Multi-server switcher, per-module toggles across all 44 modules in 6 groups
- Per-channel feature scoping (everywhere / only here / all except, with
  category support) editable from Discord or the dashboard
- Embed builder with a saved-message library, welcome/goodbye/DM builder
- Analytics: messages/day, joins vs. leaves, an activity heatmap, growth
  forecast, top channels/members/commands, member-by-role breakdown,
  moderation analytics and ticket analytics, plus the **Server Health Score**
- Reaction-role panel builder with a saved-panel library
- Premium tiers and per-feature limits (bring-your-own billing)
- Hashed API keys for a public read-only REST API (`/api/v1/...`)
- Audit log of moderation and dashboard changes
- Instance name: show your community's name next to the product name (full
  white-label needs a commercial license)
- Full UI translation in **9 languages**: English, Slovak, Czech, German,
  Polish, Russian, Spanish, Japanese, Turkish
- Custom text overrides: rewrite any string the bot says, per server, without
  touching code

**Plugin system**
- Drop-in plugins with their own slash commands and Discord event handlers,
  no core code changes needed
- Sandboxed from the rest of the config, with a context object (`ctx.client`,
  `ctx.embed`, `ctx.logger`, `ctx.t()`, `ctx.readData`/`writeData`) instead of
  importing internal paths
- **Plugins tab in the dashboard**: version, status, commands and settings of every
  plugin, plus install (from a `.zip`), enable, disable and uninstall for the bot
  owner, all picked up by the running bot within a few seconds, no restart needed
- Plugins can declare global settings (bot owner) and per-server settings with channel
  pickers and lists (server managers) in their manifest, and read them live with
  `ctx.getSettings()` / `ctx.getGuildSettings()`
- Ships with a complete working example at `plugins/sample_plugin/` and two
  ready-to-use plugins: **Minecraft status** (`plugins/minecraft_status/`, see
  its own README) with live server panels, player count, online/offline
  notifications and a configurable update interval, and **Fear & Greed**
  (`plugins/fear_greed/`, see its own README) with `/feargreed` plus an
  optional scheduled post to a channel

## Requirements

- Node.js **18+** (20 recommended)
- A Discord bot application: [discord.com/developers/applications](https://discord.com/developers/applications)
- A database backend, pick one:
  - **JSON**: zero setup, one file per table under `data/json/`. This is the
    real default in practice, since `DATABASE_TYPE=sqlite` currently also
    falls back to JSON storage (see the note below), so most self-hosted
    instances run on it.
  - **MySQL / MariaDB**: best for large servers, recommended once a server
    outgrows JSON files. Note the caveat below before relying on it for a
    multi-instance setup.

> **`DATABASE_TYPE=sqlite` is not a separate engine yet.** Setting it logs a
> warning and transparently uses the same JSON storage as `DATABASE_TYPE=json`,
> since no native SQLite driver is wired up in this version. This is safe
> (your data is still saved), just not literally SQLite. Use `mysql` if you
> need a real SQL backend. Older copies of this README also mentioned
> MongoDB. The bot has never used MongoDB.

> **`DATABASE_TYPE` only covers runtime data** (economy, moderation logs,
> tickets, giveaways, and so on). Per-server settings - prefix, language,
> modules, automod/antiraid, welcome messages, everything configured through
> `/settings` or the dashboard - always live in `<DATA_PATH>/json/guild_settings.json`,
> whichever backend you pick.

## Quick start

### Pterodactyl (recommended)

Import the egg `egg-vorqul-d-s-bot.json`, upload the files via SFTP, fill in the
Startup variables (token, client ID, etc.) and hit start. The first boot installs
dependencies and compiles the code on its own.

- **Node.js egg startup:** `npm start`
- **Python launcher egg startup:** `python3 bot.py`

### Local / VPS

```bash
git clone https://github.com/Yamiru/Vorqul-DS-BOT.git
cd Vorqul-DS-BOT

# 1. install dependencies
npm install

# 2. copy the config template and edit it
cp .env.example .env
#    then open .env and fill in DISCORD_TOKEN, DISCORD_CLIENT_ID, etc.

# 3. run it
npm start          # production
npm run dev        # development with hot reload
python3 bot.py     # alternative Python launcher
```

If the dashboard is enabled it listens on `DASHBOARD_PORT` (default `3000`),
for example `http://localhost:3000`. It works over plain `http` or `https`,
on an IP, an IP:port or a domain. Leave `NEXTAUTH_URL` empty and it detects
the address from each request. Just add every address you use as a redirect
(`<address>/api/auth/callback/discord`) in the Discord developer portal.

## Configuration

Everything is driven by environment variables. Copy `.env.example` to `.env`
and edit it. Each variable is documented inline. The essentials:

| Variable | Required | What it does |
|----------|----------|--------------|
| `DISCORD_TOKEN` | yes | Your bot token |
| `DISCORD_CLIENT_ID` | yes | Application/Client ID (slash commands + dashboard) |
| `DISCORD_CLIENT_SECRET` | dashboard only | OAuth2 client secret |
| `DATABASE_TYPE` | yes | `json` or `mysql` (see the database note above) |
| `NEXTAUTH_URL` | dashboard only | Optional. Public dashboard URL for the OAuth redirect. **Leave empty** to auto-detect it per request (works over http/https, IP, IP:port or domain). Set it only to pin the dashboard to one fixed address |
| `NEXTAUTH_SECRET` | dashboard only | Random session secret (`openssl rand -hex 32`) |
| `DASHBOARD_PASSWORD` | optional | Extra shared password in front of the whole dashboard, including Discord sign-in |
| `BOT_OWNER_ID` | recommended | Unlocks owner-only commands |
| `ALLOWED_EMAILS` / `ALLOWED_IDS` | optional | Dashboard allowlist, by email or Discord user ID (combined) |
| `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | optional | Twitch live alerts |

Module defaults, automod thresholds, colors and economy settings live in
`src/config/config.json` and can also be toggled per-server from the dashboard.

## Project structure

```
Vorqul-DS-BOT/
├── src/
│   ├── bot/
│   │   ├── commands/      # slash commands (moderation, utility, fun, economy)
│   │   ├── events/        # Discord gateway events
│   │   ├── modules/       # schedulers, plugin loader, feeds
│   │   └── index.ts       # bot entry point
│   ├── dashboard/         # Next.js 15 app (optional web UI)
│   ├── config/config.json # default configuration
│   ├── locales/           # translations (9 languages, see Localization below)
│   └── utils/             # database, i18n, helpers, logging
├── plugins/               # drop-in plugins
├── bot.py                 # Python launcher (Pterodactyl)
├── start.js               # Node launcher (Pterodactyl)
├── egg-vorqul-d-s-bot.json
├── .env.example
└── LICENSE
```

## Localization

Bot strings and the dashboard UI share one set of locale files in
`src/locales/`. Shipped languages, all 100% complete and verified key-for-key
against `en.json`: **English** (`en`, default), **Slovak** (`sk`), **Czech**
(`cs`), **German** (`de`), **Polish** (`pl`), **Russian** (`ru`), **Spanish**
(`es`), **Japanese** (`ja`), **Turkish** (`tr`).

To add a language:
1. `npm run i18n:add -- <code>` scaffolds `src/locales/<code>.json` from `en.json`.
2. Add `{ code: '<code>', label: '…', flag: '…' }` to `src/shared/languages.ts`.
   This is the single registry that both the bot's slash commands and the
   dashboard's language picker read from (**not** `supportedLanguages` in
   `config.json`, which is metadata only and not read by the running code).
3. Add the matching `import` to `src/dashboard/lib/i18n.ts`'s bundle map.
4. Translate the `[TODO]`-marked values by hand, then run `npm run i18n:check`.

## Writing a plugin

1. Make a folder under `plugins/`.
2. Add a `manifest.json`. `main` must point at a `.js` or `.mjs` file. A `.ts`
   entry point is rejected, since the bot runs compiled JavaScript:

```json
{
  "name": "my_plugin",
  "version": "1.0.0",
  "author": "Your Name",
  "description": "What it does",
  "main": "index.js",
  "enabled": true
}
```

3. Add an `index.js` that default-exports a plugin object (write it directly
   in JavaScript, or write TypeScript and compile it to `.js` yourself before
   shipping):

```javascript
export default {
  name: 'my_plugin',
  version: '1.0.0',
  author: 'Your Name',
  description: 'What it does',
  commands: [],
  events: [],
  onLoad: async (ctx) => { /* ctx.client, ctx.embed, ctx.logger, ctx.t, ... */ },
  onUnload: async (ctx) => { /* ... */ },
};
```

There's a complete, working example at `plugins/sample_plugin/`: one slash
command, one event handler and a counter persisted across restarts (ships
disabled - set `"enabled": true` to try it). For a manifest with global and
per-server settings, see `plugins/minecraft_status/manifest.json` or
`plugins/fear_greed/manifest.json`, and the matching `index.js` for how a
plugin reads them with `ctx.getSettings()` / `ctx.getGuildSettings()`.

## Command reference (selection)

**Moderation:** `/kick` `/ban` `/unban` `/softban` `/timeout` `/untimeout`
`/mute` `/unmute` `/warn` `/clear` `/slowmode` `/lock` `/unlock` `/lockdown`
`/nick` `/role` `/jail` `/unjail` `/note` `/notes` `/case` `/filter` `/altcheck`

**Utility:** `/help` `/info ping` `/info server` `/info user` `/rank` `/leaderboard`
`/tools reminder` `/info avatar` `/info members` `/tools say` `/tools announce` `/ticket` `/tools tags`
`/suggest` `/afk` `/crypto price` `/tools mcstatus` `/tools links` `/tools backup`

**Economy:** `/economy balance|daily|work|pay|bank|shop|market|casino|lootbox|spin|rob|heist`
(the old names still work with the text prefix, e.g. `!daily`)

**Fun:** `/poll` `/8ball` `/dice` `/coinflip` `/rps` `/tictactoe` `/connect4`
`/trivia` `/giveaway` `/quest`

Run `/help` in your server for the full, always-up-to-date list with descriptions.

## What's not done yet

I'd rather be honest than oversell. A few things on the list:

- Dashboard analytics graphs (the data is collected, the charts are partial)
- No music module yet (would need a Lavalink node to be useful)
- More languages beyond the current nine (English, Slovak, Czech, German, Polish, Russian, Spanish, Japanese, Turkish)

Bug reports and feature requests are welcome on [GitHub Issues](https://github.com/Yamiru/Vorqul-DS-BOT/issues).

## License

Vorqul DS BOT is **proprietary software**, not open source. See [`LICENSE`](LICENSE)
for the full terms. In short:

- You may run and configure your own instances of the bot.
- You may **not** resell, redistribute, sublicense or re-host it for others
  without written permission.
- You may **not** disable, patch out or bypass premium tier checks, feature
  gates or license key checks, or share license keys you were issued.
- Receiving a free copy does not grant any redistribution rights, and does not
  grant access to paid features.

This license is deliberately flexible for the author: the same software can be
handed out for free or sold, and free-now does not lock in free-forever. If you
want resale, white-label or hosting rights, get in touch for a commercial license.

**Why not MIT?** An open-source license like MIT would let anyone redistribute
the code for free forever, which would make it impossible to ever charge for
it. The proprietary license keeps that choice open.

## Links
- **Tutorials**: [https://github.com/Yamiru/Vorqul-DS-BOT/wiki](https://github.com/Yamiru/Vorqul-DS-BOT/wiki)
- **Repository**: [https://github.com/Yamiru/Vorqul-DS-BOT](https://github.com/Yamiru/Vorqul-DS-BOT)
- **Issues**: [https://github.com/Yamiru/Vorqul-DS-BOT/issues](https://github.com/Yamiru/Vorqul-DS-BOT/issues)
- **Author**: [https://yamiru.com](https://yamiru.com)
