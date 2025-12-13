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

        // Build lines with group metadata (core / peace / war)
        const lines = []; // { text: string, group: 'core'|'peace'|'war'|null }
        lines.push({ text: 'Core Upgrades', group: 'core' });
        let armoryNames = [];
        for (const upgrade of data.upgrades.core.upgrades) {
            if (upgrade.name && String(upgrade.name).toLowerCase().includes('armory')) {
                armoryNames.push(upgrade.name.replace(/\s+armory$/i, ''));
            } else {
                lines.push({ text: `  ${upgrade.name} - ${upgrade.ability}`, group: 'core' });
            }
        }
        if (armoryNames.length) {
            lines.push({ text: `  Armory: ${armoryNames.join(', ')}`, group: 'core' });
        }
        lines.push({ text: '', group: null });

        lines.push({ text: 'Peace Upgrades', group: 'peace' });
        for (const branch of data.upgrades.peace) {
            lines.push({ text: `  ${branch.name}`, group: 'peace' });
            for (const upgrade of branch.upgrades) {
                lines.push({ text: `    ${upgrade.name} - ${upgrade.ability}`, group: 'peace' });
            }
        }
        lines.push({ text: '', group: null });

        lines.push({ text: 'War Upgrades', group: 'war' });
        for (const branch of data.upgrades.war) {
            lines.push({ text: `  ${branch.name}`, group: 'war' });
            for (const upgrade of branch.upgrades) {
                lines.push({ text: `    ${upgrade.name} - ${upgrade.ability}`, group: 'war' });
            }
        }

        // Image rendering settings
        const padding = 24;
        const maxWidth = 1100;
        const fontSize = 18;
        const fontFamily = 'Sans';
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

        const baseColors = {
            core: '#FFFFFF',
            peace: '#FFFFFF',
            peaceDim: '#AAAAAA',
            war: '#FFFFFF',
            warDim: '#AAAAAA'
        };


        const state = (data.state || '').toLowerCase();
        let dimMode = 'desaturate'; 
        let inactiveGroup = null;
        if (state === 'peace') {
            dimMode = 'opacity';
            inactiveGroup = 'war';
        } else if (state === 'war') {
            dimMode = 'opacity';
            inactiveGroup = 'peace';
        }

        function colorForGroup(group) {
            if (!group) return '#ffffff';
            if (group === 'core') return baseColors.core;

            if (dimMode === 'opacity') {
                if (group === inactiveGroup) return group === 'peace' ? baseColors.peaceDim : baseColors.warDim;
                return group === 'peace' ? baseColors.peace : baseColors.war;
            } else {
                // fallback darker variants when state is unknown
                return group === 'peace' ? baseColors.peaceDim : baseColors.warDim;
            }
        }

        // Wrap and measure lines while preserving group and level
        const fontSizes = { 0: 26, 1: 22, 2: 18 };
        const lineHeightFactor = 1.3;

        let visualLines = []; // { text, group, level, fontSize, lineHeight }
        let measuredMaxWidth = 0;
        const textMaxWidth = maxWidth - padding * 2;
        for (const ln of lines) {
            if (!ln.text) {
                visualLines.push({ text: '', group: null, level: 0, fontSize: fontSizes[0], lineHeight: Math.round(fontSizes[0] * lineHeightFactor) });
                continue;
            }

            const leading = (ln.text.match(/^ */) || [''])[0].length;
            let level = Math.min(2, Math.floor(leading / 2));
            // Use smallest font size for core upgrade list items (they are indented)
            if (ln.group === 'core' && level === 1) level = 2;
            const rawText = ln.text.trim();
            const fsz = fontSizes[level] || fontSize;

            measureCtx.font = `${fsz}px ${fontFamily}`;
            const wrapped = wrapLine(measureCtx, rawText, textMaxWidth);
            for (const wln of wrapped) {
                const w = Math.ceil(measureCtx.measureText(wln).width);
                visualLines.push({ text: wln, group: ln.group, level, fontSize: fsz, lineHeight: Math.round(fsz * lineHeightFactor) });
                measuredMaxWidth = Math.max(measuredMaxWidth, w);
            }
        }

        const canvasWidth = Math.min(maxWidth, measuredMaxWidth + padding * 2);
        const canvasHeight = padding * 2 + visualLines.reduce((sum, l) => sum + l.lineHeight, 0);

        const canvas = createCanvas(canvasWidth, canvasHeight);
        const ctx = canvas.getContext('2d');

        // rounded corners, if you think i wouldnt have an ai do this for me youre silly
        const cornerRadius = 24;
        ctx.fillStyle = '#0A2472';
        (function roundedRect(ctx, x, y, w, h, r) {
            const radius = Math.max(0, Math.min(r, Math.min(w / 2, h / 2)));
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            ctx.fill();
        })(ctx, 0, 0, canvasWidth, canvasHeight, cornerRadius);

        ctx.textBaseline = 'top';

        let y = padding;
        for (const vln of visualLines) {
            ctx.font = `${vln.fontSize}px ${fontFamily}`;
            ctx.fillStyle = colorForGroup(vln.group);
            const textWidth = Math.ceil(ctx.measureText(vln.text).width);
            const x = Math.round((canvasWidth - textWidth) / 2);
            ctx.fillText(vln.text, x, y);
            y += vln.lineHeight;
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