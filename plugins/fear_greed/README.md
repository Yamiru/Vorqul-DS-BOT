# fear_greed

The Crypto Fear & Greed Index (data from [Alternative.me](https://alternative.me/crypto/fear-and-greed-index/))
as a plugin.

Part of [Vorqul DS BOT](https://vorqul.com). Enabled by default: set
`"enabled": false` in `manifest.json` (or use the switch in the dashboard) to turn it off.

## Command

| Command | What it does |
| --- | --- |
| `/feargreed` | Shows the current index (0-100) with a gauge, its classification and what it means. |

## Automatic posts (dashboard)

Open **Settings > Plugins > fear_greed > Server settings**:

- **Post automatically**: on or off
- **Channel**: where the index is posted
- **Post every (hours)**: 1 to 168 (default 24)
- **Language of the message**

Anyone who can manage the Discord server can change this; each server has its own
settings. Changes are picked up without a restart.

## Notes

- The value is cached for 30 minutes, so many commands cause a single request.
- The time of the last automatic post is kept in `plugins/fear_greed/data/state.json`.
