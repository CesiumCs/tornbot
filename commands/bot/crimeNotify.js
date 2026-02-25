const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../../config.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('crimenotify')
		.setDescription('Options for crime level empty alerts')
		.addSubcommand(subcommand =>
			subcommand.setName('set')
				.setDescription('Decide if a specific crime level will trigger an alert when empty')
				.addIntegerOption(option =>
					option.setName('level')
						.setDescription('The crime level to set the alert for.')
						.setRequired(true)
						.setMinValue(1)
						.setMaxValue(10))
				.addBooleanOption(option =>
					option.setName('notify')
						.setDescription('Whether to notify when this crime level is empty.')
						.setRequired(true))
		)
		.addSubcommand(subcommand =>
			subcommand.setName('list')
				.setDescription('List all crime levels and whether they trigger an alert when empty.')
		),
	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'list') {
			let message = 'Crime levels and whether they trigger an alert when empty:\n';
			if (config.crimeNotify) {
				for (const level in config.crimeNotify) {
					message += `Crime level ${level}/10 will ${config.crimeNotify[level] ? 'notify' : 'not notify'} when empty.\n`;
				}
			} else {
				message += 'No alert overrides set.\n';
			}
			await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
		} else if (subcommand === 'set') {
			const level = interaction.options.getInteger('level');
			const notify = interaction.options.getBoolean('notify');

			if (!config.crimeNotify) {
				config.crimeNotify = {};
			}
			config.crimeNotify[level] = notify;

			const fs = require('fs');
			const path = require('path');
			try {
				fs.writeFileSync(path.join(__dirname, '../../config.json'), JSON.stringify(config, null, 2));
			} catch (error) {
				console.error('Failed to save config.json:', error);
			}

			await interaction.reply({ content: `Crime level ${level}/10 will ${notify ? 'notify' : 'not notify'} when empty.`, flags: MessageFlags.Ephemeral });
		}
	},
};