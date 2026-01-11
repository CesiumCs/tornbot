const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('tasks')
		.setDescription('Lists all available tasks.'),
	async execute(interaction) {
		const taskNames = Object.keys(interaction.client.tasks);

		if (taskNames.length === 0) {
			await interaction.reply({ content: 'No tasks found.', flags: MessageFlags.Ephemeral });
			return;
		}

		const embed = new EmbedBuilder()
			.setColor(0xBB99FF)
			.setTitle('Available Tasks')
			.setDescription(taskNames.map(name => `- ${name}`).join('\n'));

		await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	},
};