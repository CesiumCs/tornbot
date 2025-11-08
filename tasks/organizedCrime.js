module.exports = async (client, torn, config, state) => {
    const { EmbedBuilder } = require('discord.js');
    const fs = require('fs');
    const channel = client.channels.resolve(config.channels.ocAlert);
    state = require('../state.json');
    let crimes = {
        difficulty: [
            { 
                name: '1/10',
                count: 0 
            },
          { 
                name: '2/10',
                count: 0 
            },
            { 
                name: '3/10',
                count: 0 
            },
            { 
                name: '4/10',
                count: 0 
            },
        ]
    };
    let embed = new EmbedBuilder()
        .setTitle('Crime Availability Check')
    await torn.api(`https://api.torn.com/v2/faction/crimes?cat=recruiting&offset=0&sort=DESC`).then(data => {
        data.crimes.forEach(crime => {
            crimes.difficulty[crime.difficulty - 1].count++
        });
        let isSomethingZero = false;
        crimes.difficulty.forEach(difficulty => {
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
                channel.send({ embeds: [embed] });
                state.ocAlertLast = now.toISOString();
                fs.writeFile('./state.json', JSON.stringify(state, null, 4), err => {if (err) {console.error(err)}});
            }
        }
    });
};

module.exports.schedule = '* * * * *';