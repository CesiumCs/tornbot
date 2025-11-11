const { SlashCommandBuilder } = require('discord.js');
const torn = require('../../torn.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('api')
		.setDescription('Directly request the Torn API')
		.addStringOption(option => 
			option.setName('url')
			.setDescription('Full URL excluding API key')),
	async execute(interaction) {
		const url = interaction.options.getString('url');
		const res = await torn.api(url)
		console.log(JSON.stringify(res))
		await interaction.reply("```json\n" + JSON.stringify(res) + "\n```");
	},
};