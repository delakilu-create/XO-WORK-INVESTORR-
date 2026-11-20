require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { commands } = require('./commands');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('Missing DISCORD_TOKEN or CLIENT_ID in .env.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
const body = commands.map(command => command.toJSON());

(async () => {
  try {
    if (GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
      console.log(`Registered ${body.length} commands in guild ${GUILD_ID}.`);
    } else {
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body });
      console.log(`Registered ${body.length} global commands. Global propagation may take time.`);
    }
  } catch (error) {
    console.error('Command registration failed:', error);
    process.exitCode = 1;
  }
})();
