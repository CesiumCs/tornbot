const config = require('./config')
module.exports = () => {};
module.exports.readyCheck = async (key) => {
    const url = `https://api.torn.com/user/?selections=basic&key=${key}` 
    const response = await fetch(url);
    const data = await response.json();
    console.log(`Torn: Connected as ${data.name} [${data.player_id}]`);
};
module.exports.test = async () => {
    const url = `https://api.torn.com/user/?selections=basic&key=${config.torn}` 
    const response = await fetch(url);
    const data = await response.json();
    return(`Connected to Torn as ${data.name} [${data.player_id}]`);
};
module.exports.api = async (url) => {
    const response = await fetch(`${url}&key=${config.torn}`);
    const data = await response.json();
    return(data);
};

module.exports.user = {
    async basic(user) {
        const response = await fetch(`https://api.torn.com/user/${user}?selections=basic&key=${config.torn}`);
        const data = await response.json();
    return(data);
    },
    async profile(user) {
        const response = await fetch(`https://api.torn.com/user/${user}?selections=profile&key=${config.torn}`);
        const data = await response.json();
        return(data);
    },
    async stats(user, category, statName) {
        let url = `https://api.torn.com/v2/user`;
        if (user) { url += `/${user}/personalstats` };
        if (category) { url += `?cat=${category}` } else { url += `?cat=all` };
        if (statName) { url += `&stat=${statName}` };
        const response = await fetch(url);
        const data = await response.json();
        return(data);
    }
};

module.exports.faction = {
    async basic(faction) {
        let response
        if (faction) {
            response = await fetch(`https://api.torn.com/v2/faction/${faction}/basic?key=${config.torn}`);
        } else {
            response = await fetch(`https://api.torn.com/v2/faction/basic?key=${config.torn}`);
        }
        const data = await response.json();
        return(data.basic);
    },
    async members(faction) {
        let response
        if (faction) {
            response = await fetch(`https://api.torn.com/v2/faction/${faction}/members?striptags=true&key=${config.torn}`);
        } else {
            response = await fetch(`https://api.torn.com/v2/faction/members?striptags=true&key=${config.torn}`);
        }
        const data = await response.json();
        return(data.members);
    },
    async crimes(category) {
        let response
        if (category) {
            response = await fetch(`https://api.torn.com/v2/faction/crimes/${category}?key=${config.torn}`);
        } else {
            response = await fetch(`https://api.torn.com/v2/faction/crimes?key=${config.torn}`);
        }
        const data = await response.json();
        return(data.crimes);
    }
}

module.exports.item = async (item) => {
    const response = await fetch(`https://api.torn.com/v2/torn/${item}/items?sort=ASC&key=${config.torn}`);
    const data = await response.json();
    return(data);
}


module.exports.self = {
    async id() {
        if (!config.tornid) {
            const url = `https://api.torn.com/user/?selections=basic&key=${config.torn}`
            const response = await fetch(url);
            const data = await response.json();
            config.tornid = data.player_id;
            console.log(`Torn: Retrieved default ID as "${data.player_id}"`)
            return(data.player_id);
        } else return config.tornid;
    }
}