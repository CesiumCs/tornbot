
const fs = require('fs');
const path = require('node:path');
const torn = require('./torn.js');
const { fetchAndProcessHistory } = require('./utils/ocLogic');
const express = require('express');

let config, state;
let stateWasCreated = false;
try {
    console.debug("Core: Loading config")
    config = require('./config.json');
} catch {
    console.error("Fatal: Unable to load config.json. Please follow the instructions in README.md");
    process.exit(1);
}
try {
    console.debug("Core: Loading state")
    state = require('./state.json');
} catch {
    console.log("Core: No state file found, creating one.")
    state = {
        "ocAlertLast": "2025-01-01T00:00:00.000Z",
        "payoutAlertLast": "2025-01-01T00:00:00.000Z",
        "itemAlertLast": "2025-01-01T00:00:00.000Z"
    }
    fs.writeFileSync('./state.json', JSON.stringify(state));
    stateWasCreated = true;
}


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
    torn.readyCheck();
});
client.login(config.token);
client.commands = new Collection();
client.tasks = {};

fs.readdir('./tasks/', (err, files) => {
    if (err) return console.log(err);
    const taskNames = [];
    files.forEach(file => {
        const taskFile = require(`./tasks/${file}`);
        const taskName = file.split('.')[0];
        client.tasks[taskName] = taskFile;
        taskNames.push(taskName);
        console.debug(`Tasks: Registered "${taskName}"`);
    });

    // Round-robin scheduler
    let currentTaskIndex = 0;
    const runNextTask = () => {
        if (taskNames.length === 0) return;

        const taskName = taskNames[currentTaskIndex];
        const taskFile = client.tasks[taskName];
        const now = new Date();
        const dateString = now.toLocaleTimeString('en-US', { hour12: false }) + ' ' + now.toLocaleDateString('en-US');

        try {
            console.debug(`Tasks: Executing "${taskName}" at ${dateString}`);
            taskFile(client, torn, config, state);
        } catch (error) {
            console.error(`Tasks: Error executing "${taskName}" at ${dateString}:`, error);
        }

        currentTaskIndex = (currentTaskIndex + 1) % taskNames.length;

        const waitMinutes = config.taskWaitMinutes || 5;
        setTimeout(runNextTask, waitMinutes * 60 * 1000);
    };

    // Start the loop with an initial delay
    if (taskNames.length > 0) {
        const waitMinutes = config.taskWaitMinutes || 5;
        console.log(`Tasks: Scheduler started. First task will run in ${waitMinutes} minutes.`);
        setTimeout(runNextTask, waitMinutes * 60 * 1000);
    }
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
            console.debug(`Commands: Registered "${command.data.name}"`);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// On client ready, generate upgrades image if missing or on first run
client.on(Events.ClientReady, async () => {
    // 1. Check and populate OC Stats if missing
    try {
        const statsPath = path.resolve(__dirname, 'data/ocStats.json');
        const dataDir = path.dirname(statsPath);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        if (!fs.existsSync(statsPath)) {
            console.log('Startup: ocStats.json missing. Initiating auto-population (scanning last 90 days)...');
            // Scan 90 days by default for safety
            fetchAndProcessHistory(torn, statsPath, 90).then(count => {
                console.log(`Startup: Auto-population complete. Updated/Created stats for ${count} users.`);
            }).catch(e => {
                console.error('Startup: Auto-population failed', e);
            });
        }
    } catch (err) {
        console.error('Startup: Error checking ocStats', err);
    }

    // 2. Upgrades Image check
    try {
        const imgDir = path.resolve(__dirname, 'public');
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
        const imgPath = path.join(imgDir, 'upgrades.png');
        if (stateWasCreated || !fs.existsSync(imgPath)) {
            const cmd = client.commands.get('updateupgrades');
            if (cmd && typeof cmd.execute === 'function') {
                console.debug('Startup: Generating upgrades image (missing or first run)');
                const mockInteraction = {
                    deferReply: async () => { },
                    editReply: async () => { }
                };
                try {
                    await cmd.execute(mockInteraction);
                    console.debug('Startup: upgrades image generation complete');
                } catch (err) {
                    console.error('Startup: failed to generate upgrades image', err);
                }
            }
        }
    } catch (err) {
        console.error('Startup: error while ensuring upgrades image', err);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'delete_message') {
            try {
                await interaction.message.delete();
                console.debug('Interaction: Deleted message via button.');
            } catch (error) {
                console.error('Interaction: Error deleting message:', error);
                await interaction.reply({ content: 'There was an error trying to delete this message.', ephemeral: true });
            }
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    } try {
        console.debug(`Command: Executing ${interaction.commandName}`);
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
    if (message.content.match(regexProfile) && !message.author.bot) {
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

const publicDir = path.resolve(__dirname, 'public');
fs.mkdirSync(publicDir, { recursive: true });
const port = config.httpPort || 3000;
const app = express();
app.use(express.static(publicDir));
app.listen(port, () => {
    console.log(`Web: http://localhost:${port}/ (serving ${publicDir})`);
});
