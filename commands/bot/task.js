const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('task')
		.setDescription('Execute a task.'),
	async execute(interaction) {
		await interaction.reply('todo');
	},
};