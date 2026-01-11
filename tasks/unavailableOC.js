module.exports = async (client, torn, config) => {

    const { EmbedBuilder } = require('discord.js');
    const fs = require('fs');
    const channel = client.channels.resolve(config.channels.ocAlert);
    const state = require('../state.json');

    let factionMaxCrime = 0;
    const crimeLevel = (await torn.faction.upgrades()).upgrades.core.upgrades.find(upgrade => upgrade.name.startsWith("Organized Crimes")).level
    switch (crimeLevel) {
        case 1:
            factionMaxCrime = 2
            break;
        case 2:
            factionMaxCrime = 4
            break;
        case 3:
            factionMaxCrime = 6
            break;
        case 4:
            factionMaxCrime = 8
            break;
        case 5:
            factionMaxCrime = 10
            break;
        default:
            factionMaxCrime = 0
    }
    console.debug(`unavailableOC: Faction max crime level determined to be ${factionMaxCrime}`);

    let crimes = {
        difficulty: []
    };
    for (let i = 1; i <= factionMaxCrime; i++) {
        crimes.difficulty.push({
            name: `${i}/10`,
            count: 0
        });
    }

    let embed = new EmbedBuilder()
        .setTitle('Crime Availability Check')
    await torn.faction.crimes({ category: 'recruiting', offset: 0, sort: 'DESC' }).then(crimeList => {
        if (!crimeList) {
            console.error("unavailableOC: API returned no crimes.");
            return;
        }
        const data = { crimes: crimeList };
        data.crimes.forEach(crime => {
            crimes.difficulty[crime.difficulty - 1].count++
        });
        let isSomethingZero = false;
        crimes.difficulty.forEach(difficulty => {
            console.debug(`unavailableOC: ${difficulty.name}: ${difficulty.count}`);
            if (difficulty.count === 0) {
                isSomethingZero = true;
                embed.addFields({
                    name: `Difficulty ${difficulty.name}`,
                    value: `Nobody can sign up for ${difficulty.name} crimes!`
                })
            } else {
                embed.addFields({
                    name: `Difficulty ${difficulty.name}`,
                    value: `There are ${difficulty.count} ${difficulty.name} crimes!`
                })
            }
        });
        if (isSomethingZero) {
            const now = new Date();
            const then = new Date(state.ocAlertLast);
            const twelveHours = 12 * 60 * 60 * 1000;
            if (now.getTime() - then.getTime() > twelveHours) {
                const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
                console.debug(`unavailableOC: Sending alert`);
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('delete_message')
                            .setLabel('Click when sorted')
                            .setStyle(ButtonStyle.Success),
                    );
                channel.send({ embeds: [embed], components: [row] });
                state.ocAlertLast = now.toISOString();
                fs.writeFile('./state.json', JSON.stringify(state, null, 4), err => { if (err) { console.error(err) } });
            } else { console.debug(`unavailableOC: Would send alert, but one was sent recently`); }
        } else {
            console.debug(`unavailableOC: All crimes available, not sending alert`);
            const now = new Date();
            const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            state.ocAlertLast = twentyFourHoursAgo.toISOString();
            fs.writeFile('./state.json', JSON.stringify(state, null, 4), err => { if (err) { console.error(err) } });

        }
    });
};

module.exports.schedule = '30 * * * *';