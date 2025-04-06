const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const torn = require('../../torn.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('profile')
		.setDescription('Get your Torn profile')
		.addIntegerOption(option => 
			option.setName('id')
			.setDescription('User ID')),
	async execute(interaction) {
		let id
		console.log(interaction.options.getInteger('id'))
		if (!interaction.options.getInteger('id')) {
			id = await torn.self.id()
			console.log(id + " yes")
		} else {
			id = interaction.options.getInteger('id');
			console.log(id + " no");
		}
		userdata = await torn.user.profile(id);
		console.log(userdata)
		switch (userdata.status.color) {
			case 'green':
				userdata.status.hex = 0x69A829
				break
			case 'orange':
				userdata.status.hex = 0xF6B200
				break
			case 'red':
				userdata.status.hex = 0xF78483
				break
			case 'blue':
				userdata.status.hex = 0x4A91B2
		}

		const userEmbed = new EmbedBuilder()
			.setColor(userdata.status.hex)
			.setTitle(`${userdata.name} [${userdata.player_id}]`)
			.setURL(`https://torn.com/profiles.php?XID=${userdata.player_id}`)
			.setImage(userdata.profile_image)
			.setDescription(userdata.rank)
			.addFields(
				{ name: userdata.status.description, value: userdata.status.details },
				{ name: 'Level', value: `${userdata.level}`, inline: true },
				{ name: 'Age', value: `${userdata.age} days`, inline: true },
				{ name: `${userdata.last_action.status}`, value: `${userdata.last_action.relative}`, inline: true },
			)

		await interaction.reply({ embeds: [userEmbed] });
	},
};
