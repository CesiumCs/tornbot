// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits } = require('discord.js');
const cron = require('node-cron');
const fs = require('fs');
const torn = require('./torn.js');

const config = require('./config.json');
const state = require('./state.json');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// When the client is ready, run this code (only once).
// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
// It makes some properties non-nullable.
client.once(Events.ClientReady, readyClient => {
	console.log(`Connected to Discord as ${readyClient.user.tag}`);
});

torn.readyCheck(config.torn);

// Log in to Discord with your client's token
client.login(config.token);
let task
fs.readdir('./tasks/', (err, files) => {
    if (err) return console.log(err);
    files.forEach(file => {
      const task = require(`./tasks/${file}`);
      const taskName = file.split('.')[0];
      console.log(`Scheduling task "${taskName}" for ${task.schedule}`);
      cron.schedule(task.schedule, () => { task(client, torn, config, state); });
    });
  });
