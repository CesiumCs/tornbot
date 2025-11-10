const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const torn = require('../../torn.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('howiskzn')
		.setDescription('How is KZNKing doing'),
	async execute(interaction) {
        const kznID = 3392710
        const KZNKing = await torn.user.profile(kznID);
        let message = `${KZNKing.name} has ${KZNKing.friends} friends and ${KZNKing.enemies} enemies. `;
        (KZNKing.married.duration) ? message += `He has been married to [${KZNKing.married.spouse_name}](https://www.torn.com/profiles.php?XID=${KZNKing.married.spouse_id}) for ${KZNKing.married.duration} days. ` : message += `He is not married. `;
        (KZNKing.property === "Private Island") ? message += `He has a Private Island. ` : message += `He does not have a Private Island. `;
        (KZNKing.job.position === "Director") ? message += `He is director of ${KZNKing.job.company_name}. ` : message += `He is not director of a company. `;
        (KZNKing.faction.position === "Leader") ? message += `He is leader of ${KZNKing.faction.faction_name}. ` : message += `He is not leader of his faction. `;
        
        const company = (await torn.api(`https://api.torn.com/v2/user/${kznID}/job?`)).job;
        const jobEmbed = new EmbedBuilder()
            .setTitle(company.name)
            .setURL(`https://www.torn.com/joblist.php#/p=corpinfo&ID=${company.id}`)
            .addFields(
                {
                name: "Stars",
                value: String(company.rating),
                inline: true
                },
                {
                name: "Days",
                value: String(company.days_in_company),
                inline: true
                },
            )

        const faction = await torn.faction.basic(KZNKing.faction.faction_id)
        const facEmbed = new EmbedBuilder()
            .setTitle(faction.name)
            .setURL(`https://www.torn.com/factions.php?step=profile&ID=${faction.id}`)
            .addFields(
                {
                    name: "Members",
                    value: `${faction.members}/${faction.capacity}`,
                    inline: true
                },
                {
                    name: "Rank",
                    value: `${faction.rank.name} ${faction.rank.division}`,
                    inline: true
                },
                {
                    name: "Respect",
                    value: `${faction.respect}`,
                    inline: true
                },
                {
                    name: "Age",
                    value: `${faction.days_old}`,
                    inline: true
                }
            )


        interaction.reply({ content: message, embeds: [jobEmbed, facEmbed] });
	},
};