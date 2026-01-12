const fs = require('fs');
const path = require('path');
const { getMemberMap, processCrimes } = require('../utils/ocLogic');

module.exports = async (client, torn, config) => {
    const statsPath = path.join(__dirname, '../data/ocStats.json');

    // Load existing stats
    let stats = {};
    try {
        if (fs.existsSync(statsPath)) {
            stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        }
    } catch (e) {
        console.error("trackOC: Failed to load ocStats.json", e);
    }

    // Fetch faction members
    const memberMap = await getMemberMap(torn);

    // Fetch recent crimes (last 48 hours to be safe and catch up)
    const now = Date.now();
    const twoDaysAgo = Math.floor((now - (48 * 60 * 60 * 1000)) / 1000);

    let crimesList = [];
    const categories = ['recruiting', 'planned', 'active', 'successful', 'failed'];

    for (const cat of categories) {
        try {
            const crimes = await torn.faction.crimes({ from: twoDaysAgo, sort: 'ASC', category: cat });
            if (crimes && Array.isArray(crimes)) {
                crimesList = crimesList.concat(crimes);
            }
        } catch (e) {
            console.error(`trackOC: Failed to fetch crimes for category '${cat}'`, e);
        }
    }

    if (!crimesList || crimesList.length === 0) {
        console.debug("trackOC: No crimes found in the last 48 hours.");
        return;
    }

    // Process crimes using utility
    const updates = await processCrimes(crimesList, stats, memberMap, torn);

    if (updates > 0) {
        try {
            const dir = path.dirname(statsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(statsPath, JSON.stringify(stats, null, 4));
            console.log(`trackOC: Updated participation for ${updates} users.`);
        } catch (e) {
            console.error("trackOC: Failed to save stats", e);
        }
    } else {
        console.debug("trackOC: No new updates.");
    }
};