require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Events,
  MessageFlags
} = require('discord.js');
const { setTimeout: delay } = require('node:timers/promises');
const config = require('./config');
const { AnnouncedStore, GuildSettingsStore } = require('./storage');
const { RobloxClient } = require('./roblox');
const { GroupMonitor } = require('./monitor');
const { createDropEmbed } = require('./embeds');

if (!config.token || !config.clientId) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID. Copy .env.example to .env and fill them in.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const announcedStore = new AnnouncedStore(config.stateFile);
const settingsStore = new GuildSettingsStore(config.setupFile, config.defaultGroupId);
const roblox = new RobloxClient({ userAgent: config.userAgent, timeoutMs: config.requestTimeoutMs });
const monitor = new GroupMonitor({ client, roblox, announcedStore, settingsStore });

client.once(Events.ClientReady, readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}.`);
  monitor.start(config.pollIntervalMs);
});

client.on(Events.GuildCreate, async guild => {
  // Give a newly joined server the configured default group; admins still run /setup for channel + role.
  await settingsStore.set(guild.id, { groupId: config.defaultGroupId });
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.inGuild()) {
    await interaction.reply({ content: 'Use this command inside a server.', flags: MessageFlags.Ephemeral });
    return;
  }
  if (!interaction.memberPermissions?.has('Administrator')) {
    await interaction.reply({ content: 'Only server administrators can use this command.', flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    if (interaction.commandName === 'setup') {
      const groupId = interaction.options.getString('group_id', true).trim();
      const channel = interaction.options.getChannel('channel', true);
      const role = interaction.options.getRole('ping_role', true);
      if (!/^\d{1,20}$/.test(groupId)) {
        await interaction.reply({ content: 'That does not look like a valid numeric Roblox group ID.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (role.managed || role.id === interaction.guildId) {
        await interaction.reply({ content: 'Choose a normal server role that the bot can mention.', flags: MessageFlags.Ephemeral });
        return;
      }
      const botMember = await interaction.guild.members.fetchMe();
      const botCanSend = channel.permissionsFor(botMember)?.has(['ViewChannel', 'SendMessages', 'EmbedLinks']);
      const botCanMention = role.mentionable || botMember.permissions.has('MentionEveryone');
      if (!botCanSend || !botCanMention) {
        await interaction.reply({
          content: 'I need View Channel, Send Messages, and Embed Links in that channel. The ping role must be mentionable, or I need the Mention Everyone permission.',
          flags: MessageFlags.Ephemeral
        });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const seededCount = await monitor.seedGroup(groupId);
      await settingsStore.set(interaction.guildId, {
        groupId,
        channelId: channel.id,
        pingRoleId: role.id
      });
      await interaction.editReply(
        `Saved. Monitoring Roblox group **${groupId}** and posting in ${channel} with ${role}. Seeded ${seededCount} currently live item IDs without announcements.`
      );
      return;
    }

    if (interaction.commandName === 'testdrop') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const item = await monitor.testDrop(interaction.guildId, interaction.channel);
      await interaction.editReply(`Preview posted for **${item.name || item.id}**. No role was pinged.`);
      return;
    }

    if (interaction.commandName === 'forcecheck') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await monitor.scanGuild(interaction.guildId);
      await interaction.editReply('Scan finished. Any newly detected, live items with ready thumbnails have been announced.');
    }
  } catch (error) {
    console.error(`Command /${interaction.commandName} failed:`, error);
    const message = `Command failed: ${error.message}`.slice(0, 1_900);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(message).catch(() => {});
    } else {
      await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

async function bootstrap() {
  try {
    await settingsStore.load();
    const state = await announcedStore.load();
    if (!state.existed) {
      console.log('First boot: seeding currently live catalog item IDs without posting announcements.');
      // Do not start monitoring with an empty baseline after a transient Roblox outage,
      // or the first successful poll could announce the whole existing catalog.
      while (true) {
        try {
          const count = await monitor.seedGroup(config.defaultGroupId);
          console.log(`Seeded ${count} live item IDs. Future new drops will be announced.`);
          break;
        } catch (error) {
          console.error(`Initial Roblox seed failed: ${error.message}. Retrying in 30 seconds.`);
          await delay(30_000);
        }
      }
    }
    await client.login(config.token);
  } catch (error) {
    console.error('Startup failed:', error);
    process.exit(1);
  }
}

process.on('unhandledRejection', error => console.error('Unhandled promise rejection:', error));
process.on('uncaughtException', error => {
  console.error('Uncaught exception:', error);
  // Avoid silently continuing after an unknown process-level failure.
  process.exit(1);
});
process.on('SIGINT', () => { monitor.stop(); client.destroy(); process.exit(0); });
process.on('SIGTERM', () => { monitor.stop(); client.destroy(); process.exit(0); });

bootstrap();
