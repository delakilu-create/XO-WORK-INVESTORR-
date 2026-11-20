const { isLiveAndPriced } = require('./roblox');
const { createDropEmbed } = require('./embeds');

class GroupMonitor {
  constructor({ client, roblox, announcedStore, settingsStore, logger = console }) {
    this.client = client;
    this.roblox = roblox;
    this.announcedStore = announcedStore;
    this.settingsStore = settingsStore;
    this.logger = logger;
    this.running = false;
    this.timer = null;
  }

  start(intervalMs) {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.scanAll().catch(error => this.logger.error('Scheduled scan failed:', error));
    }, intervalMs);
    this.timer.unref?.();
    this.scanAll().catch(error => this.logger.error('Initial scan failed:', error));
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async scanAll() {
    if (this.running) {
      this.logger.warn('Scan skipped: another scan is already running.');
      return;
    }
    this.running = true;
    try {
      const guildIds = this.settingsStore.guildIds();
      for (const guildId of guildIds) {
        try {
          await this.scanGuild(guildId);
        } catch (error) {
          this.logger.error(`Scan failed for guild ${guildId}:`, error);
        }
      }
    } finally {
      this.running = false;
    }
  }

  async fetchReadyItems(groupId) {
    const items = await this.roblox.getGroupItems(groupId);
    const liveItems = items.filter(isLiveAndPriced);
    const ready = [];
    for (const item of liveItems) {
      try {
        const thumbnailUrl = await this.roblox.getThumbnail(item);
        if (thumbnailUrl) ready.push({ item, thumbnailUrl });
      } catch (error) {
        this.logger.warn(`Thumbnail lookup failed for item ${item.id}: ${error.message}`);
      }
    }
    return { items, liveItems, ready };
  }

  async seedGroup(groupId) {
    const items = await this.roblox.getGroupItems(groupId);
    const ids = items
      .filter(item => item.id != null && isLiveAndPriced(item))
      .map(item => item.id);
    await this.announcedStore.addMany(ids);
    return ids.length;
  }

  async scanGuild(guildId) {
    const settings = this.settingsStore.get(guildId);
    if (!settings.channelId || !settings.pingRoleId) return;
    const channel = await this.client.channels.fetch(settings.channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || !channel.send) {
      this.logger.warn(`Configured channel is unavailable for guild ${guildId}.`);
      return;
    }

    const { ready } = await this.fetchReadyItems(settings.groupId);
    for (const { item, thumbnailUrl } of ready) {
      if (this.announcedStore.has(item.id)) continue;
      try {
        await channel.send({
          content: `<@&${settings.pingRoleId}>`,
          embeds: [createDropEmbed(item, thumbnailUrl)]
        });
        // Persist only after Discord confirms the send, so failed sends can retry.
        await this.announcedStore.add(item.id);
        this.logger.info(`Announced item ${item.id} to guild ${guildId}.`);
      } catch (error) {
        this.logger.error(`Could not announce item ${item.id}:`, error);
      }
    }
  }

  async testDrop(guildId, channel) {
    const settings = this.settingsStore.get(guildId);
    const { ready } = await this.fetchReadyItems(settings.groupId);
    const latest = ready[0];
    if (!latest) throw new Error('No live, priced item with a completed thumbnail was found in the current catalog page.');
    await channel.send({ embeds: [createDropEmbed(latest.item, latest.thumbnailUrl, { preview: true })] });
    return latest.item;
  }
}

module.exports = { GroupMonitor };
