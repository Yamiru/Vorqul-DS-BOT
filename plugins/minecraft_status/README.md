# minecraft_status

Live Minecraft server status panels for Discord. The bot posts one message per
server, edits it on a schedule you choose, and can rename a channel to show the
player count.

Part of [Vorqul DS BOT](https://vorqul.com). Enabled by default: set
`"enabled": false` in `manifest.json` to turn it off.

## Setting it up in the dashboard

Open **Settings > Plugins > minecraft_status > Server settings**. Add a server and fill in:

- **Server name** and **Address**, plus a **Port** if it is not the default
- **Edition**: Java or Bedrock
- **Status channel**: where the live message is posted and edited
- **Update every (minutes)**: how often it refreshes
- **Channel to rename** (optional): renamed to e.g. `🟢 12/100 players`
- whether to **show player names** and **announce offline / online**
- the **language** of the message

Save, and the running bot picks it up on its own, with no restart. Anyone who can manage
the Discord server can do this, and each server has its own list. Everything is configured
in the dashboard; there is no setup command.

## Command

| Command | What it does |
| --- | --- |
| `/minecraft [server]` | Shows the current status and the address (IP and port) of a configured server, or of all of them when `server` is left empty. It also refreshes the live message. |

## What the panel shows

Server name, online/offline, players (`12/100` with a bar), version, address,
response time, the MOTD, and the names of online players when the server shares
them. A footer says how often it updates.

## Options

- **Update every (minutes)**: 2 to 1440 (default 10); the bot owner sets the default and minimum.
- **Edition**: `java` (default, pinged directly) or `bedrock` (looked up through
  the public mcsrvstat.us API).
- **Show player names**: list the online player names when the server exposes them.
- **Announce offline / online**: post a short message when the server goes offline (after two
  failed checks in a row) and when it comes back.
- **Channel to rename**: a voice or text channel renamed to e.g. `🟢 12/100 players`.
  Discord allows two renames per ten minutes, so it changes at most every five minutes.
- **Language**: language of the panel (English, Slovak, Czech, German, Polish, Russian,
  Spanish, Japanese, Turkish).

Up to five servers per Discord server. Java servers behind an SRV record work
without a port.

## Plugin settings (bot owner)

In the dashboard, **Settings > Plugins > minecraft_status > Settings** lets the bot
owner change the defaults and limits for every server, with no restart:

- default update interval and the shortest allowed interval
- how many servers one Discord server may track
- minutes between channel renames
- whether player names and offline/online notices are on by default
- whether private and local addresses are allowed

## Notes

- Private, loopback and link-local addresses are refused, so nobody can use the
  bot to probe your internal network. If your Minecraft server really is on the same
  private network, the bot owner can allow it in the plugin settings (or set
  `MC_STATUS_ALLOW_PRIVATE=true` in `.env`).
- Per-server settings are stored in `plugins/minecraft_status/data/guilds/<server id>.json`.
- The bot needs View Channel, Send Messages and Embed Links in the status channel
  (and Manage Channels for `stat_channel`).
