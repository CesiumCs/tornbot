const { SlashCommandBuilder } = require('discord.js');
const torn = require('../../torn.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('calcpayout')
		.setDescription('[WIP] Calculate war payout based on participation')
		.addIntegerOption(option => 
			option.setName('total')
			.setDescription('Full war earnings total before cuts')),
	async execute(interaction) {
        const total = interaction.options.getInteger('total');
        const lastWarRaw = await torn.api('https://api.torn.com/v2/faction/rankedwars?offset=0&limit=1&sort=DESC');
        const lastWarID = lastWarRaw.rankedwars[0].id
        const lastWar = await torn.api(`https://api.torn.com/v2/faction/${lastWarID}/rankedwarreport?`);
        const ourMembers = lastWar.rankedwarreport.factions.find(faction => faction.id === 53026).members; // TODO: dont hardcore faction ID
        let totalParticipants = 0;
        let message = `# War Payout Calculation for War against ${lastWar.rankedwarreport.factions.find(faction => faction.id !== 53026).name} with total earnings of $${total.toLocaleString()}:\n`;
        ourMembers.forEach(member => {
            if (member.id == 2993713) {
                console.log(`User ${member.name} is calculated separately.`);
            } else if (member.attacks > 0) {
                console.log(`${member.name} participated with ${member.attacks} attacks.`);
                totalParticipants++;
                message += `- ${member.name}: Participated with a score of ${member.score} from ${member.attacks} attacks.\n`;
            } else {
                console.log(`${member.name} did not participate.`);
            }
        });
        message += `## OseanWorld. earned $${total.toLocaleString()} with Yameii earning 10% off the top for a total of $${Math.ceil(total * 0.1).toLocaleString()}, leaving ${Math.floor(total * 0.9).toLocaleString()} for ${totalParticipants} participants.\n`;
        message += `## Dividing that out gives each participant approximately $${Math.floor((total * 0.9) / totalParticipants).toLocaleString()} each.`;
        console.log(`there were ${totalParticipants} participants`);
        console.log(message)
        interaction.reply(message);
	},
};