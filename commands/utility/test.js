const { SlashCommandBuilder } = require('discord.js');
const torn = require('../../torn.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('Test the Torn API'),
	async execute(interaction) {
		await interaction.reply(await torn.test());
	},
};