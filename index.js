const cron = require('node-cron');
const fs = require('fs');
const path = require('node:path');
const torn = require('./torn.js');

const config = require('./config.json');
const state = require('./state.json');

// the basic discord setup stuff yoinked from their guide
const { Client, Collection, Events, GatewayIntentBits, SlashCommandBuilder } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once(Events.ClientReady, readyClient => {
	console.log(`Connected to Discord as ${readyClient.user.tag}`);
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
            console.log(`Scheduling task "${taskName}" for ${taskFile.schedule}`);
            cron.schedule(taskFile.schedule, () => { taskFile(client, torn, config, state); });
        } else {
            console.log(`Registered task "${taskName}"`);
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
