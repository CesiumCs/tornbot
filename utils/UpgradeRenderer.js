const { createCanvas } = require('canvas');
const config = require('../config.json');

class UpgradeRenderer {
    constructor() {
        this.padding = 24;
        this.maxWidth = 1100;
        this.fontFamily = 'Sans';
        this.baseColors = {
            core: config.upgradeColors.core,
            peace: config.upgradeColors.peace,
            peaceDim: config.upgradeColors.peaceDim,
            war: config.upgradeColors.war,
            warDim: config.upgradeColors.warDim,
            background: config.upgradeColors.background
        };
        this.fontSizes = { 0: 26, 1: 22, 2: 18 };
        this.lineHeightFactor = 1.3;
    }

    /**
     * Renders the upgrades data to a PNG buffer.
     * @param {Object} data The data returned from torn.faction.upgrades()
     * @returns {Buffer} The PNG image buffer
     */
    render(data) {
        const lines = this.buildLines(data);
        const state = (data.state || '').toLowerCase();
        const dimMode = (state === 'peace' || state === 'war') ? 'opacity' : 'desaturate';
        const inactiveGroup = state === 'peace' ? 'war' : (state === 'war' ? 'peace' : null);

        // Measurement Canvas
        const measureCanvas = createCanvas(10, 10);
        const measureCtx = measureCanvas.getContext('2d');

        const visualLines = this.measureAndWrapLines(measureCtx, lines);
        const { width, height } = this.calculateCanvasDimensions(visualLines);

        // Final Canvas
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        this.drawBackground(ctx, width, height);
        this.drawText(ctx, visualLines, width, dimMode, inactiveGroup);

        return canvas.toBuffer('image/png');
    }

    buildLines(data) {
        const lines = []; // { text: string, group: 'core'|'peace'|'war'|null }

        // Core
        lines.push({ text: 'Core Upgrades', group: 'core' });
        const armoryNames = [];
        if (data.upgrades.core.upgrades) {
            for (const upgrade of data.upgrades.core.upgrades) {
                if (upgrade.name && String(upgrade.name).toLowerCase().includes('armory')) {
                    armoryNames.push(upgrade.name.replace(/\s+armory$/i, ''));
                } else {
                    lines.push({ text: `  ${upgrade.name} - ${upgrade.ability}`, group: 'core' });
                }
            }
        }
        if (armoryNames.length) {
            lines.push({ text: `  Armory: ${armoryNames.join(', ')}`, group: 'core' });
        }
        lines.push({ text: '', group: null });

        // Peace
        lines.push({ text: 'Peace Upgrades', group: 'peace' });
        if (data.upgrades.peace) {
            for (const branch of data.upgrades.peace) {
                lines.push({ text: `  ${branch.name}`, group: 'peace' });
                for (const upgrade of branch.upgrades) {
                    lines.push({ text: `    ${upgrade.name} - ${upgrade.ability}`, group: 'peace' });
                }
            }
        }
        lines.push({ text: '', group: null });

        // War
        lines.push({ text: 'War Upgrades', group: 'war' });
        if (data.upgrades.war) {
            for (const branch of data.upgrades.war) {
                lines.push({ text: `  ${branch.name}`, group: 'war' });
                for (const upgrade of branch.upgrades) {
                    lines.push({ text: `    ${upgrade.name} - ${upgrade.ability}`, group: 'war' });
                }
            }
        }

        return lines;
    }

    measureAndWrapLines(ctx, lines) {
        const visualLines = [];
        const textMaxWidth = this.maxWidth - this.padding * 2;

        for (const ln of lines) {
            if (!ln.text) {
                visualLines.push({
                    text: '',
                    group: null,
                    level: 0,
                    width: 0,
                    fontSize: this.fontSizes[0],
                    lineHeight: Math.round(this.fontSizes[0] * this.lineHeightFactor)
                });
                continue;
            }

            const leading = (ln.text.match(/^ */) || [''])[0].length;
            let level = Math.min(2, Math.floor(leading / 2));
            if (ln.group === 'core' && level === 1) level = 2;

            const fsz = this.fontSizes[level];
            ctx.font = `${fsz}px ${this.fontFamily}`;

            const rawText = ln.text.trim();
            const wrapped = this.wrapLine(ctx, rawText, textMaxWidth);

            for (const wln of wrapped) {
                const w = Math.ceil(ctx.measureText(wln).width);
                visualLines.push({
                    text: wln,
                    group: ln.group,
                    level,
                    width: w,
                    fontSize: fsz,
                    lineHeight: Math.round(fsz * this.lineHeightFactor)
                });
            }
        }
        return visualLines;
    }

    wrapLine(ctx, text, maxW) {
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

    calculateCanvasDimensions(visualLines) {
        let maxW = 0;
        let totalH = 0;
        for (const line of visualLines) {
            maxW = Math.max(maxW, line.width);
            totalH += line.lineHeight;
        }
        return {
            width: Math.min(this.maxWidth, maxW + this.padding * 2),
            height: this.padding * 2 + totalH
        };
    }

    drawBackground(ctx, width, height) {
        const cornerRadius = 24;
        ctx.fillStyle = this.baseColors.background;

        const r = Math.max(0, Math.min(cornerRadius, Math.min(width / 2, height / 2)));
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(width - r, 0);
        ctx.quadraticCurveTo(width, 0, width, r);
        ctx.lineTo(width, height - r);
        ctx.quadraticCurveTo(width, height, width - r, height);
        ctx.lineTo(r, height);
        ctx.quadraticCurveTo(0, height, 0, height - r);
        ctx.lineTo(0, r);
        ctx.quadraticCurveTo(0, 0, r, 0);
        ctx.closePath();
        ctx.fill();
    }

    drawText(ctx, visualLines, width, dimMode, inactiveGroup) {
        ctx.textBaseline = 'top';
        let y = this.padding;

        for (const vln of visualLines) {
            ctx.font = `${vln.fontSize}px ${this.fontFamily}`;
            ctx.fillStyle = this.getColorForGroup(vln.group, dimMode, inactiveGroup);

            const x = Math.round((width - vln.width) / 2);
            ctx.fillText(vln.text, x, y);
            y += vln.lineHeight;
        }
    }

    getColorForGroup(group, dimMode, inactiveGroup) {
        if (!group) return '#ffffff';
        if (group === 'core') return this.baseColors.core;

        if (dimMode === 'opacity') {
            if (group === inactiveGroup) return group === 'peace' ? this.baseColors.peaceDim : this.baseColors.warDim;
            return group === 'peace' ? this.baseColors.peace : this.baseColors.war;
        } else {
            return group === 'peace' ? this.baseColors.peaceDim : this.baseColors.warDim;
        }
    }
}

module.exports = new UpgradeRenderer();
