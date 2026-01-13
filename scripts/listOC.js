// makes a list of members last OC time, outputs to activity_visualization.md


const torn = require('../torn.js');
const fs = require('fs');
const path = require('path');

(async () => {
    try {
        // Load stats
        const statsPath = './data/ocStats.json';
        let stats = {};
        if (fs.existsSync(statsPath)) {
            stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        } else {
            console.log("No ocStats.json found.");
        }

        // Fetch members
        console.log("Fetching members...");
        const members = await torn.faction.members();

        // Fetch current crimes
        console.log("Fetching current crimes...");
        const activeCrimes = new Map(); // userId -> { crimeId, category, time }
        const categories = ['recruiting', 'planned', 'active'];

        const promises = categories.map(cat => torn.faction.crimes({ category: cat, limit: 100 }));
        const results = await Promise.all(promises);

        results.forEach((crimes, index) => {
            const cat = categories[index];
            if (crimes && Array.isArray(crimes)) {
                crimes.forEach(c => {
                    const completed = ['Successful', 'Failure', 'Canceled', 'Expired', 'Timeout'];
                    // We catch everything but flag status for visualization
                    // But if we want to mimic inactive.js strict active check:
                    // Only treat as 'current' if NOT completed.

                    // Actually, for visualization, let's keep the record but mark it differently?
                    // The user wants to see "Stage".
                    // If it is completed, it should be treated as "Historic" essentially, logic-wise for "Active" label.

                    if (c.slots && Array.isArray(c.slots)) {
                        c.slots.forEach(s => {
                            if (s.user && s.user.id) {
                                const newStatus = c.status;
                                const newIsCompleted = completed.includes(newStatus);

                                const existing = activeCrimes.get(s.user.id);
                                if (existing && !existing.isCompleted && newIsCompleted) {
                                    // Existing is active, new is completed. Do NOT overwrite.
                                    return;
                                }

                                activeCrimes.set(s.user.id, {
                                    crimeId: c.id,
                                    category: cat,
                                    status: newStatus,
                                    started: c.time_started || c.initiated_at || c.created_at,
                                    isCompleted: newIsCompleted
                                });
                            }
                        });
                    }
                });
            }
        });

        let output = "# Activity Visualization\n\n";
        output += "| Name | Stage | Last Time | Details |\n";
        output += "|---|---|---|---|\n";

        // Calculate latestTime for everyone first to allow sorting
        const memberData = members.map(m => {
            const stat = stats[m.id];
            const current = activeCrimes.get(m.id);

            const currentStart = current ? current.started * 1000 : 0;
            const lastSeen = stat ? stat.lastSeen : 0;
            const latestTime = Math.max(currentStart, lastSeen);

            return { m, stat, current, latestTime };
        });

        // Sort: Longest time ago (smallest timestamp) first
        memberData.sort((a, b) => {
            if (a.latestTime === 0 && b.latestTime === 0) return 0;
            if (a.latestTime === 0) return -1; // Keep members with no activity at the top (or bottom, depending on desired order)
            if (b.latestTime === 0) return 1;
            return a.latestTime - b.latestTime;
        });

        memberData.forEach(({ m, stat, current, latestTime }) => {

            let stage = "Unknown";
            let timeStr = "Never";
            let details;

            const isActuallyActive = current && !current.isCompleted;

            // Helper to linkify ID
            const linkify = (id) => `[${id}](https://www.torn.com/factions.php?step=your&type=1#/tab=crimes&crimeId=${id})`;

            // Determine Stage and Details string
            if (isActuallyActive) {
                stage = `**${current.status}**`;
                details = `In: ${linkify(current.crimeId)}`;
            } else if (current && current.isCompleted) {
                // It was found in API but is completed
                stage = `${current.status}`;
                details = `Done: ${linkify(current.crimeId)}`;
            } else if (stat) {
                // Historic
                stage = "Historic";
                const diff = Date.now() - stat.lastSeen;
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                if (days < 3) stage = "Recent";
                else if (days > 7) stage = "Inactive";

                details = `Last: ${stat.lastCrimeId ? linkify(stat.lastCrimeId) : '?'}`;
            } else {
                stage = "No Data";
            }

            if (latestTime > 0) {
                const date = new Date(latestTime);
                timeStr = date.toLocaleString();

                // Add relative time
                const diff = Date.now() - latestTime;
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                if (days === 0) timeStr += " (Today)";
                else if (days === 1) timeStr += " (Yesterday)";
                else timeStr += ` (${days} days ago)`;
            }

            output += `| ${m.name} | ${stage} | ${timeStr} | ${details} |\n`;
        });

        fs.writeFileSync('activity_visualization.md', output, 'utf8');
        console.log("Written output to activity_visualization.md");

    } catch (e) {
        console.error("Error:", e);
    }
})();
