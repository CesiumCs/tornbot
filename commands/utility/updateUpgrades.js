const { SlashCommandBuilder } = require('discord.js');
const torn = require('../../torn.js');
const fs = require('fs');
const path = require('path');
// eslint-disable-next-line no-unused-vars
const { createCanvas, registerFont } = require('canvas');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('updateupgrades')
        .setDescription('Generate the faction upgrades PNG'),

    async execute(interaction) {
        await interaction.deferReply(); // give more time for image generation

        const data = await torn.faction.upgrades();

        const lines = [];
        lines.push("Core Upgrades:");
        let armoryNames = [];
        for (const upgrade of data.upgrades.core.upgrades) {
            if (upgrade.name && String(upgrade.name).toLowerCase().includes('armory')) {
                armoryNames.push(upgrade.name.replace(/\s+armory$/i, ''));
            } else {
                lines.push(`  ${upgrade.name} - ${upgrade.ability}`);
            }
        }
        if (armoryNames.length) {
            lines.push(`  Armory: ${armoryNames.join(', ')}`);
        }
        lines.push("");
        lines.push("Peace Upgrades:");
        for (const branch of data.upgrades.peace) {
            lines.push(`  ${branch.name}`);
            for (const upgrade of branch.upgrades) {
                lines.push(`    ${upgrade.name} - ${upgrade.ability}`);
            }
        }
        lines.push("");
        lines.push("War Upgrades:");
        for (const branch of data.upgrades.war) {
            lines.push(`  ${branch.name}`);
            for (const upgrade of branch.upgrades) {
                lines.push(`    ${upgrade.name} - ${upgrade.ability}`);
            }
        }

        // Image rendering settings
        const padding = 24;
        const maxWidth = 1100;
        const fontSize = 18;
        const fontFamily = 'Sans';
        const lineHeight = Math.round(fontSize * 1.4);
        const fontSpec = `${fontSize}px ${fontFamily}`;

        // Temporary canvas for measurement
        const measureCanvas = createCanvas(10, 10);
        const measureCtx = measureCanvas.getContext('2d');
        measureCtx.font = fontSpec;

        function wrapLine(ctx, text, maxW) {
            const words = text.split(' ');
            const wrapped = [];
            let line = '';
            for (const word of words) {
                const test = line ? `${line} ${word}` : word;
                const w = ctx.measureText(test).width;
                if (w > maxW && line) {
                    wrapped.push(line);
                    line = word;
                } else {
                    line = test;
                }
            }
            if (line) wrapped.push(line);
            return wrapped;
        }

        let visualLines = [];
        let measuredMaxWidth = 0;
        const textMaxWidth = maxWidth - padding * 2;
        for (const ln of lines) {
            if (!ln) {
                visualLines.push('');
                continue;
            }
            const wrapped = wrapLine(measureCtx, ln, textMaxWidth);
            for (const wln of wrapped) {
                visualLines.push(wln);
                measuredMaxWidth = Math.max(measuredMaxWidth, Math.ceil(measureCtx.measureText(wln).width));
            }
        }

        const canvasWidth = Math.min(maxWidth, measuredMaxWidth + padding * 2);
        const canvasHeight = padding * 2 + visualLines.length * lineHeight;

        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#0A2472';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        ctx.font = fontSpec;
        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'top';

        let y = padding;
        for (const vln of visualLines) {
            ctx.fillText(vln, padding, y);
            y += lineHeight;
        }

        const outDir = path.resolve(__dirname, '..', '..', 'public', 'images');
        fs.mkdirSync(outDir, { recursive: true });

        const outFile = path.join(outDir, 'upgrades.png');
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outFile, buffer);

        try {
            await interaction.editReply({ files: [outFile] });
        } catch (err) {
            await interaction.editReply('Generated upgrades image but failed to attach it.');
            console.debug('Failed to attach image to interaction reply:', err.message || err);
        }
    },
};