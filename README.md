# Roblox UGC Drop Alert Bot

A GitHub-ready Discord bot built with Node.js and `discord.js` v14. It polls a public Roblox group catalog, waits for a completed thumbnail, then posts new live/priced assets or bundles with a thumbnail, price, item link, and configured role mention.

**Default group:** XO Works (`749117113`).

## Requirements

- Node.js 20.11+
- A Discord application and bot token
- A server where you have permission to add bots and configure roles/channels

The bot uses only public Roblox catalog and thumbnail endpoints. It does **not** use `.ROBLOSECURITY`, browser cookies, login sessions, or private Roblox credentials.

## Setup

1. Create a Discord application at the [Discord Developer Portal](https://discord.com/developers/applications).
2. Under **Bot**, create/reset the bot token. Keep it private.
3. Under **OAuth2 → URL Generator**, select `bot` and `applications.commands`. Grant at least:
   - View Channels
   - Send Messages
   - Embed Links
   - Mention Everyone (only if the selected ping role is not set to **Allow anyone to @mention this role**)
4. Invite the bot to your server. For role pings, either make the selected role mentionable in its role settings or grant the bot Mention Everyone. The setup command checks for one of those conditions.
5. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN` and `CLIENT_ID`. Optionally set `GUILD_ID` for quick test-server command registration.
6. Install and register commands:

   ```bash
   npm install
   npm run register
   npm start
   ```

7. In Discord, run `/setup` as a server administrator. Enter:
   - Roblox group ID (defaults to `749117113`)
   - Announcement text channel
   - Ping role

8. Run `/testdrop` to post a preview without a role ping. `/forcecheck` runs an immediate scan.

## First boot and state

On the first start, if `data/announced.json` does not exist, the bot seeds it with currently live and priced item IDs from the default group. It does not announce those existing items. This prevents a flood of old catalog drops.

After first boot, every successfully announced item ID is persisted to `data/announced.json` using a temporary file and atomic rename. Keep the `data/` directory on persistent storage. The file is intentionally ignored by Git.

If you change the monitored group with `/setup`, the shared announcement store still tracks IDs globally. Roblox item IDs are globally unique, so this avoids repeat posts if the same item appears in more than one configured server.

## Configuration

| Variable | Default | Purpose |
|---|---:|---|
| `DISCORD_TOKEN` | — | Discord bot token |
| `CLIENT_ID` | — | Discord application/client ID |
| `GUILD_ID` | empty | Optional test guild for command registration |
| `ROBLOX_GROUP_ID` | `749117113` | Group used to seed first-run state and as `/setup` default |
| `POLL_INTERVAL_MS` | `90000` | Poll interval; values below 30 seconds are clamped to 30 seconds |
| `REQUEST_TIMEOUT_MS` | `15000` | HTTP timeout |
| `ROBLOX_USER_AGENT` | built-in | Descriptive HTTP User-Agent |

`/setup` stores each server's group, channel, and role in `data/guild-settings.json`.

## Hosting

### Railway

1. Push this repository to GitHub and create a Railway project from the repository.
2. Add the environment variables from `.env.example` in Railway's Variables panel.
3. Use `npm start` as the start command. Run `npm run register` once as a deployment/release command or locally before starting.
4. Attach a persistent volume and mount it at the project directory (or otherwise preserve `data/`). Without persistent storage, the bot may lose its duplicate-prevention state after redeploys.

### Render

Use a **Background Worker**, not a web service. Connect the GitHub repository, set build command to `npm install`, start command to `npm start`, and add the environment variables. Add a persistent disk mounted so the project's `data/` directory survives restarts. Run `npm run register` locally or as a one-time pre-deploy command.

### VPS

Install Node.js 20.11+, clone the repo, create `.env`, run `npm install` and `npm run register`, then keep `npm start` running with a process manager such as systemd or PM2. Back up `data/announced.json` and `data/guild-settings.json`.

## Reliability notes

- A 429 response honors `Retry-After` when available and retries with bounded backoff. Repeated 429s are logged; the next poll can try again.
- Network errors and request timeouts are caught by the scan loop and do not terminate the bot.
- Pending/missing thumbnails are skipped and retried on a later poll.
- Only items with a non-`OffSale` `priceStatus` and a non-null/undefined `price` are eligible. `price: 0` is correctly shown as **Free**.
- Bundle links and thumbnails use bundle-specific endpoints; other items use asset endpoints.
- The catalog endpoint is paginated by Roblox. This implementation scans the first returned page (up to 30 results) per poll; it does not claim to exhaust the entire group catalog.
- Announcement state is shared across guilds and keyed by Roblox item ID. If Discord accepts a message but the process stops before the state write completes, a duplicate on a later poll is possible; this is the unavoidable send/persist boundary without a transactional outbox or Discord-side idempotency key.

## Project structure

```text
.
├── data/
│   └── .gitkeep
├── src/
│   ├── commands.js
│   ├── config.js
│   ├── deploy-commands.js
│   ├── embeds.js
│   ├── index.js
│   ├── monitor.js
│   ├── roblox.js
│   └── storage.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## GitHub push

```bash
git init
git add .
git commit -m "Initial Roblox UGC drop alert bot"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Do not commit `.env`, your bot token, or `data/announced.json`.
