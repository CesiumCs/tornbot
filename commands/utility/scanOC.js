const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { fetchAndProcessHistory } = require('../../utils/ocLogic');
const torn = require('../../torn.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scanoc')
        .setDescription('Scans historical OCs to populate participation stats.')
        .addIntegerOption(option =>
            option.setName('days')
                .setDescription('How many days back to scan (default 30)')
                .setMinValue(1)
                .setMaxValue(365)
        ),
    async execute(interaction) {
        await interaction.deferReply();

        const days = interaction.options.getInteger('days') || 30;
        const statsPath = path.join(__dirname, '../../data/ocStats.json');

        await interaction.editReply(`Scanning OCs from the last ${days} days...`);

        try {
            const updates = await fetchAndProcessHistory(torn, statsPath, days);

            if (updates > 0) {
                await interaction.editReply(`Scan complete. Updated stats for ${updates} users.`);
            } else {
                await interaction.editReply(`Scan complete. No new updates needed.`);
            }
        } catch (e) {
            console.error("scanOC: Failed to scan history", e);
            await interaction.editReply(`Scan failed: ${e.message}`);
        }
    },
};
