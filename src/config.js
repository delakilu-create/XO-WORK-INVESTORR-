const path = require('node:path');

function positiveInt(value, fallback, minimum = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  defaultGroupId: String(process.env.ROBLOX_GROUP_ID || '749117113'),
  pollIntervalMs: positiveInt(process.env.POLL_INTERVAL_MS, 90_000, 30_000),
  requestTimeoutMs: positiveInt(process.env.REQUEST_TIMEOUT_MS, 15_000, 1_000),
  userAgent: process.env.ROBLOX_USER_AGENT || 'UGCDropAlertBot/1.0 (public catalog monitor)',
  stateFile: path.join(__dirname, '..', 'data', 'announced.json'),
  setupFile: path.join(__dirname, '..', 'data', 'guild-settings.json')
};
