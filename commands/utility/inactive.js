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

        let members = [];
        try {
            // Fetch own faction members
            members = await torn.faction.members();
        } catch (e) {
            console.error("inactive: Failed to fetch members", e);
            return interaction.editReply('Failed to fetch faction members from API.');
        }

        const inactiveUsers = [];

        // Check each member
        for (const member of members) {
            const userId = member.id;
            const userName = member.name;
            const userStat = stats[userId];

            if (!userStat) {
                // Never seen in tracking
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
                    value = `Last crime: <t:${ts}:d>\n(<t:${ts}:R>)`;
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
