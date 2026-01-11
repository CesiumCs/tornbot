module.exports = async (client, torn, config) => {

    const fs = require('fs');
    const path = require('path');
    const renderer = require('../utils/UpgradeRenderer.js');

    try {
        const data = await torn.faction.upgrades();
        const buffer = renderer.render(data);

        const outDir = path.resolve(__dirname, '..', 'public');
        if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
        }

        const outFile = path.join(outDir, 'upgrades.png');
        fs.writeFileSync(outFile, buffer);
        console.debug("autoUpdateUpgrades: Successfully updated upgrades.png");
    } catch (err) {
        console.error("autoUpdateUpgrades: Failed to update upgrades.png", err);
    }
};

module.exports.schedule = '0 * * * *';
