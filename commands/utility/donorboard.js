const { SlashCommandBuilder } = require('discord.js');
const torn = require('../../torn.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('donorboard')
		.setDescription("See who's donated the most this week")
		.addIntegerOption(option => 
			option.setName('days')
			.setDescription('Get results for a different amount of time')),
	async execute(interaction) {
        let days
        if (!interaction.options.getInteger('days')) days = 7;
        else days = interaction.options.getInteger('days');
        const seconds = days * 24 * 60 * 60;
        const time = new Date(new Date().getTime() - seconds * 1000);
        let board = {};
        await torn.faction.news("armoryDeposit", time.toISOString()).then(data => {
            data.forEach(async news => {
                const regex = /<a href = "http:\/\/www\.torn\.com\/profiles\.php\?XID=(\d+)">([^<]+)<\/a> deposited (\d+) x (.+)/;
                const match = news.text.match(regex);
                if (match) {
                    const id = match[1];
                    const name = match[2];
                    const count = parseInt(match[3]);
                    const itemName = match[4];
                    const item = (await torn.item.lookup(itemName));
                    if (!board[id]) {
                        board[id] = {
                            name: name,
                            totalValue: 0,
                            items: {}
                        }
                    }
                    if (!board[id].items[item.id]) {
                        board[id].items[item.id] = {
                            name: itemName,
                            count: 0,
                            value: item.value.market_price
                        }
                    }
                    board[id].items[item.id].count += count;
                    board[id].totalValue += item.value.market_price * count;
                } else {
                    console.log("Unexpected news event: ", news.text);
                }
            });
        });;
        let message = `# Donor Board\n`;

        const sortedBoard = Object.values(board).sort((a, b) => b.totalValue - a.totalValue);

        for (const user of sortedBoard) {
            console.log(user)
            message += `## ${user.name}: $${user.totalValue.toLocaleString()}\n`;
            for (const item in user.items) {
                message += `- ${user.items[item].name}: ${user.items[item].count}\n`;
                const totalItemValue = user.items[item].count * user.items[item].value;
                message += `  - $${totalItemValue.toLocaleString()} (${user.items[item].value.toLocaleString()})\n`;
            }
        }
        interaction.reply(message);
    },
};