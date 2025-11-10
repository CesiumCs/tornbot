module.exports = async (client, torn, config) => {
    console.debug("Task: Executing unpaidOC");
    const { EmbedBuilder } = require('discord.js');
    const fs = require('fs');
    const channel = client.channels.resolve(config.channels.ocAlert);
    const now = new Date();
    const state = require('../state.json');
    let embeds = [];
    const data = await torn.api(`https://api.torn.com/v2/faction/crimes?cat=successful&from=${now.getTime() / 1000 - 7 * 24 * 60 * 60}&sort=DESC`);
    for (const crime of data.crimes) {
        if (!crime.rewards.payout) {
            console.debug(`unpaidOC: Found unpaid crime: ${crime.name}:${crime.id}`);
            const execDate = new Date(crime.executed_at * 1000);
            const embed = new EmbedBuilder()
                .setTitle(crime.name)
                .setDescription(`Completed <t:${execDate.getTime() / 1000}:R>\nCash earned: $${crime.rewards.money}`)
                .setURL(`https://www.torn.com/factions.php?step=your&type=7#/tab=crimes&crimeId=${crime.id}`);
            if (crime.rewards.money === 0) {
                const itemPromises = crime.rewards.items.map(item =>
                    torn.item(item.id).then(itemData => ({
                        quantity: item.quantity,
                        name: itemData.items[0].name,
                        value: itemData.items[0].value.market_price
                    }))
                );
                const resolvedItems = await Promise.all(itemPromises);
                let items = `Completed <t:${execDate.getTime() / 1000}:R>\nItems earned: \n`;
                resolvedItems.forEach(item => {
                    console.log(item);
                    items += `${item.quantity}x ${item.name} ($${item.value.toLocaleString()})\n`;
                });
                embed.setDescription(items);
            }
            const profilePromises = crime.slots.map(slot => 
                torn.user.profile(slot.user.id).then(profile => ({
                    name: profile.name,
                    value: `Pass rate: ${slot.checkpoint_pass_rate}`,
                    inline: true
                }))
            );
            const fields = await Promise.all(profilePromises);
            embed.addFields(fields);
            embeds.push(embed);
        }
    }
    if (embeds.length > 0) {
        const then = new Date(state.payoutAlertLast);
        const twelveHours = 12 * 60 * 60 * 1000;
        if (now.getTime() - then.getTime() > twelveHours) {
            console.debug(`unpaidOC: Sending alert`);
            channel.send({content: "# Unpaid Faction Crimes:", embeds: embeds });
            state.payoutAlertLast = now.toISOString();
            fs.writeFile('./state.json', JSON.stringify(state, null, 4), err => {if (err) {console.error(err)}});
        } else { console.debug(`unpaidOC: Would send alert, but one was sent recently`); }
    } else {
            console.debug(`unpaidOC: All crimes are paid, not sending alert`);
            const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            state.payoutAlertLast = twentyFourHoursAgo.toISOString();
            fs.writeFile('./state.json', JSON.stringify(state, null, 4), err => {if (err) {console.error(err)}});
            
        }
};

module.exports.schedule = '0 * * * *';