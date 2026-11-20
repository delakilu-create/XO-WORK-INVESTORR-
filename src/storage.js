const fs = require('node:fs/promises');
const path = require('node:path');

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Could not read ${filePath}: ${error.message}`);
  }
}

// Write to a temporary file in the same directory, then atomically rename it.
async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

class AnnouncedStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.ids = new Set();
    this.initialized = false;
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      const ids = Array.isArray(parsed) ? parsed : parsed.announcedIds;
      if (!Array.isArray(ids)) throw new Error('State file must contain an array or { announcedIds: [] }.');
      this.ids = new Set(ids.map(String));
      this.initialized = true;
      return { existed: true };
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.ids = new Set();
        this.initialized = true;
        return { existed: false };
      }
      throw new Error(`Invalid announcement state: ${error.message}`);
    }
  }

  has(id) { return this.ids.has(String(id)); }

  async add(id) {
    this.ids.add(String(id));
    await this.save();
  }

  async addMany(ids) {
    for (const id of ids) this.ids.add(String(id));
    await this.save();
  }

  async save() {
    await writeJsonAtomic(this.filePath, { announcedIds: [...this.ids] });
  }
}

class GuildSettingsStore {
  constructor(filePath, defaultGroupId) {
    this.filePath = filePath;
    this.defaultGroupId = defaultGroupId;
    this.settings = {};
  }

  async load() {
    this.settings = await readJson(this.filePath, {});
  }

  get(guildId) {
    return this.settings[guildId] || {
      groupId: this.defaultGroupId,
      channelId: null,
      pingRoleId: null
    };
  }

  async set(guildId, patch) {
    this.settings[guildId] = { ...this.get(guildId), ...patch };
    await writeJsonAtomic(this.filePath, this.settings);
    return this.settings[guildId];
  }

  guildIds() { return Object.keys(this.settings); }
}

module.exports = { AnnouncedStore, GuildSettingsStore, writeJsonAtomic };
