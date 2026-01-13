const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const torn = require('../../torn.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inactive')
        .setDescription('Shows users who haven\'t participated in an OC recently.')
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('Number of days of inactivity (default 3)')
                .setMinValue(1)
        ),
    async execute(interaction) {
        await interaction.deferReply();

        const days = interaction.options.getInteger('days') || 3;
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        const statsPath = path.join(__dirname, '../../data/ocStats.json');

        // Load tracked stats
        let stats = {};
        if (fs.existsSync(statsPath)) {
            try {
                stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
            } catch (e) {
                console.error("inactive: Failed to load ocStats.json", e);
            }
        }

        // Fetch own faction members
        try {
            members = await torn.faction.members();
        } catch (e) {
            console.error("inactive: Failed to fetch members", e);
            return interaction.editReply('Failed to fetch faction members from API.');
        }

        // Fetch currently active/planned/recruiting crimes to check for current participation
        const activeUserIds = new Set();
        try {
            const categories = ['recruiting', 'planned', 'active'];
            const promises = categories.map(cat => torn.faction.crimes({ category: cat, limit: 100 })); // limit 100 to catch most
            const results = await Promise.all(promises);

            results.forEach(crimes => {
                if (crimes && Array.isArray(crimes)) {
                    crimes.forEach(crime => {
                        // Only consider truly active/pending statuses
                        const completedStatuses = ['Successful', 'Failure', 'Canceled', 'Expired', 'Timeout'];
                        if (completedStatuses.includes(crime.status)) {
                            return;
                        }

                        if (crime.slots && Array.isArray(crime.slots)) {
                            crime.slots.forEach(slot => {
                                if (slot.user && slot.user.id) {
                                    activeUserIds.add(slot.user.id);
                                }
                            });
                        }
                    });
                }
            });
            console.log(`inactive: Found ${activeUserIds.size} users currently in crimes.`);
        } catch (e) {
            console.error("inactive: Failed to fetch current crimes", e);
        }

        const inactiveUsers = [];

        // Check each member
        for (const member of members) {
            const userId = member.id;

            // Skip if user is currently in a crime
            if (activeUserIds.has(userId)) continue;

            const userName = member.name;
            const userStat = stats[userId];

            if (!userStat || !userStat.lastSeen) {
                // Never seen in tracking or no lastSeen data
                inactiveUsers.push({
                    id: userId,
                    name: userName,
                    lastSeen: null,
                    daysInactive: -1
                });
            } else {
                if (userStat.lastSeen < cutoffTime) {
                    inactiveUsers.push({
                        id: userId,
                        name: userName,
                        lastSeen: new Date(userStat.lastSeen),
                        lastCrimeId: userStat.lastCrimeId,
                        daysInactive: Math.floor((Date.now() - userStat.lastSeen) / (24 * 60 * 60 * 1000))
                    });
                }
            }
        }

        // Sort: Never seen first, then by longest inactivity
        inactiveUsers.sort((a, b) => {
            if (a.lastSeen === null && b.lastSeen === null) return 0;
            if (a.lastSeen === null) return -1; // a comes first
            if (b.lastSeen === null) return 1;  // b comes first
            return a.lastSeen - b.lastSeen; // Older timestamp (smaller) comes first
        });

        const embed = new EmbedBuilder()
            .setTitle(`Inactive OC Members (> ${days} days)`)
            .setColor(0xFF0000)
            .setTimestamp();

        if (inactiveUsers.length === 0) {
            embed.setDescription(`Everyone has participated in an OC in the last ${days} days!`);
            embed.setColor(0x00FF00);
        } else {
            const limit = 25;
            const shownUsers = inactiveUsers.slice(0, limit);

            shownUsers.forEach(user => {
                let value = "";
                if (user.lastSeen === null) {
                    value = "Never seen in OCs (since tracking started)";
                } else {
                    const ts = Math.floor(user.lastSeen.getTime() / 1000);
                    let dateStr = `<t:${ts}:d>`;
                    if (user.lastCrimeId) {
                        const url = `https://www.torn.com/factions.php?step=your&type=1#/tab=crimes&crimeId=${user.lastCrimeId}`;
                        dateStr = `[Last crime](${url}): <t:${ts}:d>`;
                    } else {
                        dateStr = `Last crime: <t:${ts}:d>`;
                    }
                    value = `${dateStr}\n(<t:${ts}:R>)`;
                }

                embed.addFields({
                    name: `${user.name} [${user.id}]`,
                    value: value,
                    inline: true
                });
            });

            if (inactiveUsers.length > limit) {
                embed.setFooter({ text: `...and ${inactiveUsers.length - limit} more.` });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    },
};
