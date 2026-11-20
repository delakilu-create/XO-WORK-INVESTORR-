const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');

const adminOnly = (command) => command.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

const commands = [
  adminOnly(new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure the Roblox group drop alerts for this server.')
    .addStringOption(option => option.setName('group_id').setDescription('Roblox group/community ID').setRequired(true))
    .addChannelOption(option => option.setName('channel').setDescription('Channel for drop announcements').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addRoleOption(option => option.setName('ping_role').setDescription('Role to ping for new drops').setRequired(true))),
  adminOnly(new SlashCommandBuilder()
    .setName('testdrop')
    .setDescription('Post a preview of the latest live group item without pinging a role.')),
  adminOnly(new SlashCommandBuilder()
    .setName('forcecheck')
    .setDescription('Run an immediate catalog scan.'))
];

module.exports = { commands };
