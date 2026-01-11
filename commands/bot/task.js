const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const torn = require('../../torn.js');
const config = require('../../config.json');
const state = require('../../state.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('task')
		.setDescription('Execute a task.')
		.addStringOption(option =>
			option.setName('name')
				.setDescription('The name of the task to execute.')
				.setRequired(true)),
	async execute(interaction) {
		const taskName = interaction.options.getString('name');
		const task = interaction.client.tasks[taskName];

		if (!task) {
			await interaction.reply({ content: `Task "${taskName}" not found.`, flags: MessageFlags.Ephemeral });
			return;
		}

		try {
			await interaction.reply({ content: `Executing task "${taskName}"...`, flags: MessageFlags.Ephemeral });
			await task(interaction.client, torn, config, state);
			await interaction.followUp({ content: `Task "${taskName}" executed successfully.`, flags: MessageFlags.Ephemeral });
		} catch (error) {
			console.error(error);
			await interaction.followUp({ content: `There was an error while executing task "${taskName}"!`, flags: MessageFlags.Ephemeral });
		}
	},
};