const cron = require('node-cron');
const fs = require('fs');
const path = require('node:path');
const torn = require('./torn.js');

const config = require('./config.json');
const state = require('./state.json');

// the basic discord setup stuff yoinked from their guide
const { Client, Collection, Events, GatewayIntentBits, EmbedBuilder, Partials, MessageFlags } = require('discord.js');
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages, 
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel,
        Partials.Message
      ]
});
client.once(Events.ClientReady, readyClient => {
	console.log(`Discord: Connected as ${readyClient.user.tag}`);
});
client.login(config.token);
client.commands = new Collection();

torn.readyCheck(config.torn);

let task = {};
fs.readdir('./tasks/', (err, files) => {
    if (err) return console.log(err);
    files.forEach(file => {
        const taskFile = require(`./tasks/${file}`);
        const taskName = file.split('.')[0];
        task[taskName] = taskFile;
        if (taskFile.schedule) {
            console.log(`Tasks: Scheduling "${taskName}" for ${taskFile.schedule}`);
            cron.schedule(taskFile.schedule, () => { taskFile(client, torn, config, state); });
        } else {
            console.log(`Tasks: Registered "${taskName}"`);
        }
    });
});

// discord command stuff also yoinked
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);
  for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`Commands: Registered "${command.data.name}"`);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}
    
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    } try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
        }
    }
});


client.on(Events.MessageCreate, message => {
    // if we smell a profile link, resolve it
    const regexProfile = /https?:\/\/(?:www\.)?torn\.com\/profiles.*?[?&]XID=(\d+)/;
    if (message.content.match(regexProfile)) {
        const profileId = message.content.match(regexProfile)[1]
        console.log(`Chat: Detected profile link "${profileId}" in message`);
        torn.user.profile(profileId).then(data => {
            if (data.name) { // copied from commands/utility/profile.js
                console.log(`Chat: Resolved as "${data.name}"`)
                switch (data.status.color) {
                    case 'green':
                        data.status.hex = 0x69A829
                        break
                    case 'orange':
                        data.status.hex = 0xF6B200
                        break
                    case 'red':
                        data.status.hex = 0xF78483
                        break
                    case 'blue':
                        data.status.hex = 0x4A91B2
                }
                // the embed is also copied from the profile command,
                // but this way we can tweak it
                const userEmbed = new EmbedBuilder()
                    .setColor(data.status.hex)
                    .setTitle(`${data.name} [${data.player_id}]`)
                    .setURL(`https://torn.com/profiles.php?XID=${data.player_id}`)
                    .setThumbnail(data.profile_image)
                    .setDescription(data.rank)
                    .addFields(
                        { name: data.status.description, value: data.status.details },
                        { name: 'Level', value: `${data.level}`, inline: true },
                        { name: 'Age', value: `${data.age} days`, inline: true },
                        { name: `${data.last_action.status}`, value: `${data.last_action.relative}`, inline: true },
                    );
                message.reply({ embeds: [userEmbed] })
            } else console.log("Chat: Unable to resolve profile")
        });
    }
});
