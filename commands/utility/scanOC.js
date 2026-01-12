const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getMemberMap, processCrimes } = require('../../utils/ocLogic');
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
        const now = Date.now();
        const fromTimestamp = Math.floor((now - (days * 24 * 60 * 60 * 1000)) / 1000);
        const statsPath = path.join(__dirname, '../../data/ocStats.json');

        // Load existing stats
        let stats = {};
        if (fs.existsSync(statsPath)) {
            try {
                stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
            } catch (e) {
                console.error("scanOC: Failed to load ocStats.json", e);
            }
        }

        // Fetch faction members
        const memberMap = await getMemberMap(torn);

        await interaction.editReply(`Scanning OCs from the last ${days} days...`);

        let crimesList = [];
        const categories = ['recruiting', 'planned', 'active', 'successful', 'failed'];

        for (const cat of categories) {
            try {
                // Fetch with a higher limit since we are scanning back further
                const crimes = await torn.faction.crimes({
                    from: fromTimestamp,
                    sort: 'ASC',
                    category: cat,
                    limit: 300 // Reasonable batch size?
                });

                if (crimes && Array.isArray(crimes)) {
                    crimesList = crimesList.concat(crimes);
                }
            } catch (e) {
                console.error(`scanOC: Failed to fetch crimes for category '${cat}'`, e);
            }
        }

        if (crimesList.length === 0) {
            return interaction.editReply(`Scan complete. No OCs found in the last ${days} days.`);
        }

        // Process with utility
        const updates = await processCrimes(crimesList, stats, memberMap, torn);

        // Save
        if (updates > 0) {
            try {
                const dir = path.dirname(statsPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, { recursive: true });
                }
                fs.writeFileSync(statsPath, JSON.stringify(stats, null, 4));
                await interaction.editReply(`Scan complete. Processed ${crimesList.length} crimes. Updated stats for ${updates} users.`);
            } catch (e) {
                console.error("scanOC: Failed to save stats", e);
                await interaction.editReply(`Scan complete, but failed to save stats: ${e.message}`);
            }
        } else {
            await interaction.editReply(`Scan complete. Processed ${crimesList.length} crimes. No new updates needed.`);
        }
    },
};
