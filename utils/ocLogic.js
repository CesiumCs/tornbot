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

module.exports = {
    getMemberMap,
    calculateCrimeTimestamp,
    processCrimes
};
