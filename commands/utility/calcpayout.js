const { SlashCommandBuilder } = require('discord.js');
const torn = require('../../torn.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('calcpayout')
        .setDescription('Calculate war payout based on participation')
        .addIntegerOption(option =>
            option.setName('total')
                .setDescription('Full war earnings total before cuts')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('percentage')
                .setDescription('Percentage of leader cut (default 10)'))
        .addStringOption(option =>
            option.setName('method')
                .setDescription('Calculation method')
                .addChoices(
                    { name: 'Participation Based', value: 'flat' },
                    { name: 'Score Based', value: 'weighted' },
                    { name: 'Attack Based', value: 'attacks' },
                )),
    async execute(interaction) {
        const total = interaction.options.getInteger('total');
        const percentage = interaction.options.getInteger('percentage') ?? 10;
        const method = interaction.options.getString('method') ?? 'flat';

        // Calculate cuts
        const leaderCut = Math.ceil(total * (percentage / 100));
        const pool = total - leaderCut;

        await interaction.deferReply();

        try {
            const myFaction = await torn.faction.basic();
            const lastWarRaw = await torn.faction.rankedWars({ offset: 0, limit: 1, sort: 'DESC' });
            const lastWarID = lastWarRaw[0].id
            const lastWar = await torn.faction.rankedWarReport(lastWarID);
            const ourFactionId = myFaction.ID || myFaction.id; // API v1 vs v2 fallback checks
            const ourFaction = lastWar.factions.find(faction => faction.id === ourFactionId);
            const enemyFaction = lastWar.factions.find(faction => faction.id !== ourFactionId);

            if (!ourFaction) {
                return interaction.editReply('Could not find our faction in the last war report.');
            }

            const members = ourFaction.members;
            const participants = [];
            const nonParticipants = [];
            let totalScore = 0;
            let totalAttacks = 0;

            // Filter members
            for (const memberId in members) {
                const member = members[memberId];

                if (member.id == myFaction.leader_id) {
                    console.log(`User ${member.name} skipped (Leader exclusion).`);
                    continue;
                }

                if (member.attacks > 0) {
                    participants.push(member);
                    totalScore += member.score;
                    totalAttacks += member.attacks;
                } else {
                    nonParticipants.push(member);
                }
            }

            // Sort logic
            if (method === 'attacks') {
                participants.sort((a, b) => b.attacks - a.attacks);
            } else {
                participants.sort((a, b) => b.score - a.score);
            }


            let message = `# War Payout: ${ourFaction.name} vs ${enemyFaction.name}\n`;
            message += `**Total Earnings:** $${total.toLocaleString()}\n`;
            message += `**Leader Cut (${percentage}%):** $${leaderCut.toLocaleString()} (Yameii)\n`;
            message += `**Distributable Pool:** $${pool.toLocaleString()}\n`;

            let methodText = 'Participation Based';
            if (method === 'weighted') methodText = 'Score Based';
            if (method === 'attacks') methodText = 'Attack Based';

            message += `**Calculation Method:** ${methodText}\n`;
            message += `**Participants:** ${participants.length}\n\n`;

            message += `## Payouts\n`;

            if (method === 'weighted') {
                participants.forEach(member => {
                    const share = (member.score / totalScore);
                    const payout = Math.floor(pool * share);
                    message += `- **${member.name}**: $${payout.toLocaleString()} (${(share * 100).toFixed(2)}% of pool | Score: ${member.score})\n`;
                });
            } else if (method === 'attacks') {
                participants.forEach(member => {
                    const share = (member.attacks / totalAttacks);
                    const payout = Math.floor(pool * share);
                    message += `- **${member.name}**: $${payout.toLocaleString()} (${(share * 100).toFixed(2)}% of pool | Attacks: ${member.attacks})\n`;
                });
            } else {
                const payout = Math.floor(pool / participants.length);
                participants.forEach(member => {
                    message += `- **${member.name}**: $${payout.toLocaleString()}\n`;
                });
            }

            if (nonParticipants.length > 0) {
                message += `\n## Non-Participants\n`;
                message += nonParticipants.map(m => m.name).join(', ');
            }

            // Discord message limit is 2000 chars. If we have many members, it might split.
            // For now, assuming it fits or valid first chunk.
            if (message.length > 2000) {
                const chunks = message.match(/[\s\S]{1,1900}/g) || [];
                for (const chunk of chunks) {
                    if (chunk === chunks[0]) await interaction.editReply(chunk);
                    else await interaction.followUp(chunk);
                }
            } else {
                await interaction.editReply(message);
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply('An error occurred while calculating payouts.');
        }
    },
};