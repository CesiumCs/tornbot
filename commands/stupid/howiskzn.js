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
        
        const company = (await torn.company(KZNKing.job.company_id));
        const jobEmbed = new EmbedBuilder()
            .setTitle(company.name)
            .setURL(`https://www.torn.com/joblist.php#/p=corpinfo&ID=${company.ID}`)
            .addFields(
                {
                name: "Daily Income",
                value: `$${company.daily_income.toLocaleString()}`,
                inline: true
                },
                {
                name: "Weekly Income",
                value: `$${company.weekly_income.toLocaleString()}`,
                inline: true
                },
                {
                name: "Days",
                value: String(company.days_old),
                inline: true
                },
                {
                name: "Daily Customers",
                value: `${company.daily_customers}`,
                inline: true
                },
                {
                name: "Weekly Customers",
                value: `${company.weekly_customers}`,
                inline: true
                },
                {
                name: "Employees",
                value: `${company.employees_hired}/${company.employees_capacity}`,
                inline: true
                },
                {
                name: "Stars",
                value: String(company.rating),
                inline: true
                }
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
                    value: `${faction.respect.toLocaleString()}`,
                    inline: true
                },
                {
                    name: "Age",
                    value: `${faction.days_old}`,
                    inline: true
                },
                {
                    name: "Wars Won",
                    value: `${faction.rank.wins}`,
                    inline: true
                },
            );

        let companyFemales = 0;
        const companyFemalePromises = Object.entries(company.employees).map(([user]) => {
            return torn.cache.user(user).then(data => {
                if (data.gender === "Female") {
                    companyFemales++;
                }
            });
        });
            
        let factionFemales = 0;
        const factionMembers = await torn.faction.members(KZNKing.faction.faction_id);
        const factionFemalePromises = factionMembers.map((user) => {
            return torn.cache.user(user.id).then(data => {
                if (data.gender === "Female") {
                    factionFemales++;
                }
            });
        });

        // i hate async
        await Promise.all(companyFemalePromises);
        await Promise.all(factionFemalePromises);

        const companyFemalePercent = (companyFemales / company.employees_capacity) * 100;
        const factionFemalePercent = (factionFemales / faction.capacity) * 100;
            
        message += `\nbtw lol his company has ${companyFemales}/${company.employees_capacity} female employees and ${factionFemales}/${faction.capacity} female faction members\n`;
        message += `thats ${companyFemalePercent.toFixed(2)}% and ${factionFemalePercent.toFixed(2)}% respectively, and last i checked, torn has a 13.43% female population`;
        interaction.reply({ content: message, embeds: [jobEmbed, facEmbed] });
	},
};