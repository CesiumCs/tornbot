module.exports = (client, torn, config, state) => {
    //console.log(`example log ${client.user.tag}`);
};
module.exports.readyCheck = async (key) => {
    const url = `https://api.torn.com/user/?selections=basic&key=${key}` 
    const response = await fetch(url);
    const data = await response.json();
    console.log(`Connected to Torn as ${data.name} [${data.player_id}]`);
    };