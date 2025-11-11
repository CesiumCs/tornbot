const fs = require('fs');
let config;
let cache;
try {config = require('./config.json')} catch {return}
try {cache = require('./cache.json')} catch {
    cache = {
        items: {},
        users: {},
        factions: {},
        companies: {}
    };
    fs.writeFileSync('./cache.json', JSON.stringify(cache));
    return; 
}

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
module.exports.cache = {
    async user(user) {
        const twelveHours = 12 * 60 * 60 * 1000;
        const now = new Date().getTime();
        let last
        try {
            last = new Date(cache.users[user].updated).getTime();
        } catch {
            last = new Date(now - twelveHours).getTime();
        }
        if (cache.users[user] && (now - last < twelveHours)) {
            console.debug(`Cache: Hit for ${cache.users[user].name}`)
            return(cache.users[user]);
        } else {
            console.debug(`Cache: Miss for ${user}`)
            await module.exports.user.basic(user);
            console.debug(`Cache: Resolved to ${cache.users[user].name}`)
            return(cache.users[user]);
        }
    }
    //async faction(faction) {},
    //async company(company) {},
    //async item(item) {}
}

module.exports.user = {
    async basic(user) {
        const response = await fetch(`https://api.torn.com/user/${user}?selections=basic&key=${config.torn}`);
        const data = await response.json();
        const now = new Date();
            cache.users[user] = {
                name: data.name,
                player_id: data.player_id,
                level: data.level,
                gender: data.gender,
                updated: now.toISOString()
            };
        fs.writeFileSync('./cache.json', JSON.stringify(cache));
        return(data);
    },
    async profile(user) {
        const response = await fetch(`https://api.torn.com/user/${user}?selections=profile&key=${config.torn}`);
        const data = await response.json();
        const now = new Date();
            cache.users[user] = {
                name: data.name,
                player_id: data.player_id,
                level: data.level,
                gender: data.gender,
                updated: now.toISOString()
            };
        fs.writeFileSync('./cache.json', JSON.stringify(cache));
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
    },
    async upgrades() {
        const response = await fetch(`https://api.torn.com/v2/faction/upgrades?key=${config.torn}`);
        const data = await response.json();
        return(data.upgrades);
    }
}

module.exports.company = async (company) => {
        let response
        if (company) {
            response = await fetch(`https://api.torn.com/company/${company}?selections=profile&key=${config.torn}`);
        } else {
            response = await fetch(`https://api.torn.com/company/?selections=profile&key=${config.torn}`);
        }
            const data = await response.json();
            return(data.company);
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