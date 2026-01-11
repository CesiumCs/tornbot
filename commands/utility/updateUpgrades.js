const { SlashCommandBuilder } = require('discord.js');
const torn = require('../../torn.js');
const fs = require('fs');
const path = require('path');
const renderer = require('../../utils/UpgradeRenderer.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('updateupgrades')
        .setDescription('Generate the faction upgrades PNG'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const data = await torn.faction.upgrades();
            const buffer = renderer.render(data);

            const outDir = path.resolve(__dirname, '..', '..', 'public');
            if (!fs.existsSync(outDir)) {
                fs.mkdirSync(outDir, { recursive: true });
            }

            const outFile = path.join(outDir, 'upgrades.png');
            fs.writeFileSync(outFile, buffer);

            await interaction.editReply({ files: [outFile] });
        } catch (err) {
            console.error('Error generating upgrades image:', err);
            await interaction.editReply('Failed to generate upgrades image.');
        }
    },
};
