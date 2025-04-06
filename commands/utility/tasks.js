const { SlashCommandBuilder } = require('discord.js');
const torn = require('../../torn.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tasks')
		.setDescription('List tasks'),
	async execute(interaction) {
		await interaction.reply('todo');
	},
};