const { EmbedBuilder } = require('discord.js');
const { itemUrl, formatPrice } = require('./roblox');

function truncate(value, maxLength) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) return text || 'No description provided.';
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function createDropEmbed(item, thumbnailUrl, { preview = false } = {}) {
  const isBundle = String(item.itemType || '').toLowerCase() === 'bundle';
  const link = itemUrl(item);
  const type = isBundle ? 'Bundle' : 'Asset';
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(truncate(item.name || 'New Roblox UGC item', 240))
    .setURL(link)
    .setDescription(truncate(item.description, 3_800))
    .addFields(
      { name: 'Price', value: formatPrice(item.price), inline: true },
      { name: 'Type', value: type, inline: true },
      { name: 'Availability', value: item.priceStatus || 'On sale', inline: true }
    )
    .setImage(thumbnailUrl)
    .setURL(link)
    .setFooter({ text: preview ? 'Drop alert preview — no role ping sent' : 'Roblox UGC Drop Alert' })
    .setTimestamp(new Date());

  const reseller = item.lowestResalePrice ?? item.lowestPrice;
  if (reseller !== undefined && reseller !== null) {
    embed.addFields({ name: 'Resale info', value: `${Number(reseller).toLocaleString('en-US')} Robux lowest resale`, inline: true });
  }
  if (item.isLimited === true || item.itemRestrictions?.includes?.('Limited')) {
    embed.addFields({ name: 'Limited', value: 'Limited item', inline: true });
  }
  return embed;
}

module.exports = { createDropEmbed };
