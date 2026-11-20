const { setTimeout: delay } = require('node:timers/promises');

class RobloxHttpError extends Error {
  constructor(message, status, retryAfterMs = null) {
    super(message);
    this.name = 'RobloxHttpError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

class RobloxClient {
  constructor({ userAgent, timeoutMs }) {
    this.userAgent = userAgent;
    this.timeoutMs = timeoutMs;
    this.nextAllowedAt = 0;
  }

  async requestJson(url, attempt = 0) {
    const waitMs = Math.max(0, this.nextAllowedAt - Date.now());
    if (waitMs) await delay(waitMs);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json'
        },
        signal: controller.signal
      });

      if (response.status === 429) {
        const retryHeader = Number(response.headers.get('retry-after'));
        const retryAfterMs = Number.isFinite(retryHeader) && retryHeader > 0
          ? retryHeader * 1000
          : Math.min(60_000, 5_000 * (attempt + 1));
        this.nextAllowedAt = Date.now() + retryAfterMs;
        if (attempt < 3) {
          await delay(retryAfterMs);
          return this.requestJson(url, attempt + 1);
        }
        throw new RobloxHttpError(`Roblox rate limited the request; retry after ${Math.ceil(retryAfterMs / 1000)}s.`, 429, retryAfterMs);
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new RobloxHttpError(`Roblox returned HTTP ${response.status}: ${body.slice(0, 200)}`, response.status);
      }
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(`Roblox request timed out after ${this.timeoutMs}ms.`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getGroupItems(groupId) {
    const url = new URL('https://catalog.roblox.com/v1/search/items/details');
    url.search = new URLSearchParams({
      CreatorType: 'Group',
      CreatorTargetId: String(groupId),
      SortType: '3',
      Limit: '30',
      IncludeNotForSale: 'false'
    }).toString();

    const data = await this.requestJson(url.toString());
    return Array.isArray(data.data) ? data.data : [];
  }

  async getThumbnail(item) {
    const isBundle = String(item.itemType || '').toLowerCase() === 'bundle';
    const base = isBundle
      ? 'https://thumbnails.roblox.com/v1/bundles/thumbnails'
      : 'https://thumbnails.roblox.com/v1/assets';
    const params = new URLSearchParams({
      [isBundle ? 'bundleIds' : 'assetIds']: String(item.id),
      size: '420x420',
      format: 'Png',
      isCircular: 'false'
    });
    const data = await this.requestJson(`${base}?${params}`);
    const first = Array.isArray(data.data) ? data.data[0] : null;
    if (!first || first.state !== 'Completed' || typeof first.imageUrl !== 'string' || !/^https:\/\/\S+$/i.test(first.imageUrl)) {
      return null;
    }
    return first.imageUrl;
  }
}

function isLiveAndPriced(item) {
  return item.priceStatus !== 'OffSale' && item.price !== undefined && item.price !== null;
}

function itemUrl(item) {
  return String(item.itemType || '').toLowerCase() === 'bundle'
    ? `https://www.roblox.com/bundles/${item.id}`
    : `https://www.roblox.com/catalog/${item.id}`;
}

function formatPrice(price) {
  return price === 0 ? 'Free' : `${Number(price).toLocaleString('en-US')} Robux`;
}

module.exports = { RobloxClient, RobloxHttpError, isLiveAndPriced, itemUrl, formatPrice };
