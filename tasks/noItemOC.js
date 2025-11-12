module.exports = async (client, torn, config) => {
    console.debug("Task: Executing noItemOC");
    const fs = require('fs');
    const channel = client.channels.resolve(config.channels.ocAlert);
    const now = new Date();
    const state = require('../state.json');
    const data = await torn.api(`https://api.torn.com/v2/faction/crimes?cat=planning&sort=DESC`);
    let itemsneeded = 0;
    let message = "OCs with unavailable items:\n";
    for (const crime of data.crimes) {
        for (const slot of crime.slots) {
            if (slot.item_requirement) {
                if (slot.item_requirement.is_available === false) {
                    const username = (await torn.user.profile(slot.user.id)).name;
                    const itemname = (await torn.cache.item(slot.item_requirement.id)).name;
                    console.debug(`noItemOC: Found crime with unavailable item: ${crime.name}: ${slot.user.id}`);
                    message += `[${username}](https://www.torn.com/profiles.php?XID=${slot.user.id}) needs [${itemname}](https://www.torn.com/page.php?sid=ItemMarket#/market/view=search&itemID=${slot.item_requirement.id}) for [${crime.name}](https://www.torn.com/factions.php?step=your&type=1#/tab=crimes&crimeId=${crime.id})\n`;
                    itemsneeded++;
                }
            }
        }
    }

    if (itemsneeded > 0) {
        const then = new Date(state.itemAlertLast);
        const twelveHours = 12 * 60 * 60 * 1000;
        if (now.getTime() - then.getTime() > twelveHours) {
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            console.debug(`unpaidOC: Sending alert`);
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('delete_message')
                        .setLabel('Click when sorted')
                        .setStyle(ButtonStyle.Success),
                );
            channel.send({ content: message, components: [row] });
            state.itemAlertLast = now.toISOString();
            fs.writeFile('./state.json', JSON.stringify(state, null, 4), err => {if (err) {console.error(err)}});
        } else { console.debug(`noItemOC: Would send alert, but one was sent recently`); }
    } else {
            console.debug(`noItemOC: Nobody needs items, not sending alert`);
            const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            state.itemAlertLast = twentyFourHoursAgo.toISOString();
            fs.writeFile('./state.json', JSON.stringify(state, null, 4), err => {if (err) {console.error(err)}});
            
        }
};

module.exports.schedule = '45 * * * *';