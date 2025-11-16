const fs = require('fs');
let config;
let cache;
try {config = require('./config.json')} catch {return}
try {cache = require('./cache.json')} catch {
    cache = {
        users: {},
        factions: {},
        companies: {},
        items: {}
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
            console.debug(`Cache: Hit for user ${cache.users[user].name}`)
            return(cache.users[user]);
        } else {
            console.debug(`Cache: Miss for user ${user}`)
            await module.exports.user.basic(user);
            console.debug(`Cache: Resolved user ${cache.users[user].name}`)
            return(cache.users[user]);
        }
    },
    async faction(faction) {
        const twelveHours = 12 * 60 * 60 * 1000;
        const now = new Date().getTime();
        let last
        try {
            last = new Date(cache.factions[faction].updated).getTime();
        } catch {
            last = new Date(now - twelveHours).getTime();
        }
        if (cache.factions[faction] && (now - last < twelveHours)) {
            console.debug(`Cache: Hit for faction ${cache.factions[faction].name}`)
            return(cache.factions[faction]);
        } else {
            console.debug(`Cache: Miss for faction ${faction}`)
            await module.exports.faction.basic(faction);
            console.debug(`Cache: Resolved faction ${cache.factions[faction].name}`)
            return(cache.factions[faction]);
        }
    },
    async company(company) {
        const twelveHours = 12 * 60 * 60 * 1000;
        const now = new Date().getTime();
        let last
        try {
            last = new Date(cache.companies[company].updated).getTime();
        } catch {
            last = new Date(now - twelveHours).getTime();
        }
        if (cache.companies[company] && (now - last < twelveHours)) {
            console.debug(`Cache: Hit for company ${cache.companies[company].name}`)
            return(cache.companies[company]);
        } else {
            console.debug(`Cache: Miss for company ${company}`)
            await module.exports.company(company);
            console.debug(`Cache: Resolved company ${cache.companies[company].name}`)
            return(cache.companies[company]);
        }
    },
    async item(item) {
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const now = new Date().getTime();
        let last
        try {
            last = new Date(cache.items[item].updated).getTime();
        } catch {
            last = new Date(now - sevenDays).getTime();
        }
        if (cache.items[item] && (now - last < sevenDays)) {
            console.debug(`Cache: Hit for item ${cache.items[item].name}`)
            return(cache.items[item]);
        } else {
            console.debug(`Cache: Miss for item ${item}`)
            await module.exports.item(item);
            console.debug(`Cache: Resolved item ${cache.items[item].name}`)
            return(cache.items[item]);
        }
    }
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
        const data = (await response.json()).basic;
        const now = new Date();
        cache.factions[data.id] = {
            name: data.name,
            leader_id: data.leader_id,
            capacity: data.capacity,
            rank: data.rank,
            best_chain: data.best_chain,
            updated: now.toISOString()
        };
        fs.writeFileSync('./cache.json', JSON.stringify(cache));
        return(data);
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
    },
    async news(category, from) {
        const response = await fetch(`https://api.torn.com/v2/faction/news?striptags=false&limit=100&sort=DESC&from=${from}&cat=${category}&key=${config.torn}`)
        const data = await response.json();
        return(data.news);
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
    const now = new Date();
    cache.companies[data.company.ID] = {
        name: data.company.name,
        id: data.company.ID,
        company_type: data.company.company_type,
        director_id: data.company.director,
        rating: data.company.rating,
        updated: now.toISOString()
     };
    fs.writeFileSync('./cache.json', JSON.stringify(cache));
    return(data.company);
}

module.exports.item = async (item) => {
    const response = await fetch(`https://api.torn.com/v2/torn/${item}/items?sort=ASC&key=${config.torn}`);
    const data = await response.json();
    const now = new Date();
    cache.items[item] = data.items[0];
    cache.items[item].updated = now.toISOString();
    fs.writeFileSync('./cache.json', JSON.stringify(cache));
    return(data.items[0]);
}
module.exports.item.lookup = async (itemName) => {
    console.debug(`Torn: Looking up item ${itemName}`)
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const now = new Date().getTime();

    for (const itemId in cache.items) {
        if (cache.items[itemId].name === itemName) {
            let last = new Date(cache.items[itemId].updated).getTime();
            if (now - last < thirtyDays) {
                console.debug(`Cache: Hit for item ${cache.items[itemId].name}`);
                return cache.items[itemId];
            }
        }
    }

    console.debug(`Cache: Miss for item ${itemName}`);
    const response = await fetch(`https://api.torn.com/v2/torn/items?cat=All&sort=ASC&key=${config.torn}`);
    const data = await response.json();
    let target;
    data.items.forEach(item => {
        if (item.name === itemName) {
            console.debug(`Torn: Found item ${item.name} as ${item.id}`)
            target = item;
        }
    });
    if (target) {
        cache.items[target.id] = target;
        cache.items[target.id].updated = new Date().toISOString();
        fs.writeFileSync('./cache.json', JSON.stringify(cache));
    }
    return(target);
};


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