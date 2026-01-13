const fs = require('fs');
const path = require('path');

/**
 * Fetches faction members and returns a map of ID -> Name.
 * @param {Object} torn The torn wrapper instance.
 * @returns {Promise<Object>} Map of member ID to Name.
 */
async function getMemberMap(torn) {
    let memberMap = {};
    try {
        const members = await torn.faction.members();
        members.forEach(m => memberMap[m.id] = m.name);
    } catch (e) {
        console.error("ocLogic: Failed to fetch faction members for name resolution", e);
    }
    return memberMap;
}

/**
 * Calculates the best timestamp for a crime participation.
 * @param {Object} slot The user slot object.
 * @param {Object} crime The crime object.
 * @returns {number|null} Timestamp in milliseconds, or null if invalid.
 */
function calculateCrimeTimestamp(slot, crime) {
    // Priority: Max of (User join time, Crime related times)
    const timestamps = [
        slot.user.joined_at,
        crime.initiated_at,
        crime.time_started,
        crime.time_completed,
        crime.executed_at,
        crime.time_ready,
        crime.created_at
    ].filter(t => t && t > 0);

    if (timestamps.length === 0) {
        return null;
    }

    return Math.max(...timestamps) * 1000;
}

/**
 * Processes a list of crimes and updates the stats object.
 * @param {Array} crimesList List of crime objects.
 * @param {Object} stats The current stats object.
 * @param {Object} memberMap Map of user ID to name.
 * @returns {number} Number of updates made.
 */
async function processCrimes(crimesList, stats, memberMap, torn) {
    let updatedUsers = new Set();
    // We iterate sequentially to allow async fetching if needed without blasting API
    for (const crime of crimesList) {
        if (crime.slots && Array.isArray(crime.slots)) {
            for (const slot of crime.slots) {
                if (!slot.user) continue; // Skip if user data is missing
                const userId = slot.user.id;

                // Try to resolve name
                let userName = slot.user.name;
                if (!userName) userName = memberMap[userId];

                if ((!userName || userName === 'Unknown') && userId && torn) {
                    try {
                        const profile = await torn.user.profile(userId);
                        if (profile && profile.name) {
                            userName = profile.name;
                        } else {
                            console.debug(`ocLogic: Failed to resolve name for ${userId} (No name in response)`);
                        }
                    } catch (e) {
                        console.debug(`ocLogic: Error resolving name for ${userId}`, e);
                    }
                }

                if (userId) {
                    const existing = stats[userId] || {};
                    const crimeTime = calculateCrimeTimestamp(slot, crime);

                    if (!crimeTime || crimeTime === 0) continue;

                    // Update if this crime is newer than what we have stored
                    // OR if we have a better name now (and same or newer time)
                    const isNewer = !existing.lastSeen || crimeTime > existing.lastSeen;
                    const isBetterName = userName && userName !== 'Unknown' && existing.name === "Unknown";

                    if (isNewer || isBetterName) {
                        // Only update timestamp if it's actually newer
                        const newTime = isNewer ? crimeTime : existing.lastSeen;
                        const newCrimeId = isNewer ? crime.id : existing.lastCrimeId;

                        stats[userId] = {
                            name: userName || existing.name || "Unknown",
                            lastSeen: newTime,
                            lastCrimeId: newCrimeId
                        };
                        updatedUsers.add(userId);
                    }
                }
            }
        }
    }
    return updatedUsers.size;
}

/**
 * Fetches historical OCs and updates the stats file.
 * @param {Object} torn The torn wrapper instance.
 * @param {string} statsPath Path to the stats JSON file.
 * @param {number} days Number of days back to scan.
 * @returns {Promise<number>} Number of users updated.
 */
async function fetchAndProcessHistory(torn, statsPath, days) {
    const now = Date.now();
    const fromTimestamp = Math.floor((now - (days * 24 * 60 * 60 * 1000)) / 1000);

    // Load existing stats
    let stats = {};
    if (fs.existsSync(statsPath)) {
        try {
            stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        } catch (e) {
            console.error("ocLogic: Failed to load existing stats during fetch", e);
        }
    }

    // Fetch faction members
    const memberMap = await getMemberMap(torn);

    let crimesList = [];
    const categories = ['recruiting', 'planned', 'active', 'successful', 'failed'];

    console.debug(`ocLogic: Scanning history for last ${days} days...`);

    for (const cat of categories) {
        try {
            const crimes = await torn.faction.crimes({
                from: fromTimestamp,
                sort: 'ASC',
                category: cat,
                limit: 300 // Match scanoc batch size
            });

            if (crimes && Array.isArray(crimes)) {
                crimesList = crimesList.concat(crimes);
            }
        } catch (e) {
            console.error(`ocLogic: Failed to fetch crimes for category '${cat}'`, e);
        }
    }

    if (crimesList.length === 0) {
        return 0;
    }

    // Process crimes
    const updates = await processCrimes(crimesList, stats, memberMap, torn);

    // Save
    if (updates > 0) {
        try {
            const dir = path.dirname(statsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(statsPath, JSON.stringify(stats, null, 4));
            console.log(`ocLogic: Updated history for ${updates} users.`);
        } catch (e) {
            console.error("ocLogic: Failed to save stats", e);
        }
    }

    return updates;
}

module.exports = {
    getMemberMap,
    calculateCrimeTimestamp,
    processCrimes,
    fetchAndProcessHistory
};
