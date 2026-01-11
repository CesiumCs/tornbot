const fs = require('fs');
let config;
let cache;

// Load config and cache
try {
    config = require('./config.json');
} catch (e) {
    console.error("Failed to load config.json", e);
}

try {
    cache = require('./cache.json');
} catch (e) {
    cache = {
        users: {},
        factions: {},
        companies: {},
        items: {}
    };
    try {
        fs.writeFileSync('./cache.json', JSON.stringify(cache));
    } catch (writeErr) {
        console.error("Failed to write initial cache.json", writeErr);
    }
}

// Constants
const TIME_12H = 12 * 60 * 60 * 1000;
const TIME_7D = 7 * 24 * 60 * 60 * 1000;
const TIME_30D = 30 * 24 * 60 * 60 * 1000;

// Helper to save cache
function saveCache() {
    try {
        fs.writeFileSync('./cache.json', JSON.stringify(cache));
    } catch (e) {
        console.error("Failed to save cache:", e);
    }
}

// Generic Caching Helper
async function getCached(collectionName, id, fetchFn, ttl) {
    const now = new Date().getTime();
    const item = cache[collectionName][id];
    let lastUpdated = 0;

    if (item && item.updated) {
        try {
            lastUpdated = new Date(item.updated).getTime();
        } catch (e) {
            lastUpdated = 0;
        }
    }

    if (item && (now - lastUpdated < ttl)) {
        console.debug(`Cache: Hit for ${collectionName} ${item.name || id}`);
        return item;
    } else {
        console.debug(`Cache: Miss for ${collectionName} ${id || 'unknown'}`);
        try {
            // The fetchFn is expected to update the cache and return the data, or we can structure it differently.
            // Based on the refactor code below, the fetchFn calls saveCache() and returns the data.
            // But wait, the original logic for checking cache was inside the 'cache' object functions, 
            // calling the specific fetcher which updated the cache.
            // In the refactored 'api.cache.user' below, I call 'api.user.basic(user)'.
            // 'api.user.basic' updates the cache and returns data.
            // So this helper just needs to return that result.
            // BUT, I need to make sure I return the logical object.

            const result = await fetchFn();
            console.debug(`Cache: Resolved ${collectionName} ${id}`);

            // If the fetchFn updated the cache, we can return the cached item to be consistent 
            // or just the result. The original returned the cached item in the cache wrapper.
            // Let's return the result from fetchFn which is usually the data.
            // However, the original cache wrappers returned `cache.users[user]`.
            // Let's see if there is a difference.
            // `api.user.basic` returns `data`. `cache.users[user]` is a subset of `data`?
            // Original:
            // `cache.users[user] = { name, player_id, level, ... }`
            // `return(data)` (full api response)
            // But `module.exports.cache.user` returned `cache.users[user]`.
            // So the CACHE wrapper returned the CACHED OBJECT (subset), while the FETCH function returned the FULL API response.
            // This is a subtle difference.
            // If I want to maintain compatibility, `getCached` should return the cached item from `cache` after fetching.

            return cache[collectionName][id];
        } catch (e) {
            console.error(`Error fetching for ${collectionName} ${id}:`, e);
            throw e;
        }
    }
}

// Helper for generic API fetching
async function fetchApi(path) {
    const glue = path.includes('?') ? '&' : '?';
    const response = await fetch(`${path}${glue}key=${config.torn}`);
    const data = await response.json();
    if (data.error) {
        console.error(`Torn API Error on ${path}:`, JSON.stringify(data.error));
    }
    return data;
}

const api = {
    readyCheck: async (key) => {
        const url = `https://api.torn.com/user/?selections=basic&key=${key}`;
        const response = await fetch(url);
        const data = await response.json();
        console.log(`Torn: Connected as ${data.name} [${data.player_id}]`);
    },

    test: async () => {
        const url = `https://api.torn.com/user/?selections=basic&key=${config.torn}`;
        const response = await fetch(url);
        const data = await response.json();
        return `Connected to Torn as ${data.name} [${data.player_id}]`;
    },

    api: async (url) => {
        const response = await fetch(`${url}&key=${config.torn}`);
        return response.json();
    },

    cache: {
        async user(user) {
            return getCached('users', user, async () => await api.user.basic(user), TIME_12H);
        },
        async faction(faction) {
            return getCached('factions', faction, async () => await api.faction.basic(faction), TIME_12H);
        },
        async company(company) {
            return getCached('companies', company, async () => await api.company(company), TIME_12H);
        },
        async item(item) {
            return getCached('items', item, async () => await api.item(item), TIME_7D);
        }
    },

    user: {
        async basic(user) {
            const data = await fetchApi(`https://api.torn.com/user/${user}?selections=basic`);
            const now = new Date();
            cache.users[user] = {
                name: data.name,
                player_id: data.player_id,
                level: data.level,
                gender: data.gender,
                updated: now.toISOString()
            };
            saveCache();
            return data;
        },
        async profile(user) {
            const data = await fetchApi(`https://api.torn.com/user/${user}?selections=profile`);
            const now = new Date();
            cache.users[user] = {
                name: data.name,
                player_id: data.player_id,
                level: data.level,
                gender: data.gender,
                updated: now.toISOString()
            };
            saveCache();
            return data;
        },
        async stats(user, category, statName) {
            let url = `https://api.torn.com/v2/user`;
            if (user) { url += `/${user}/personalstats`; }
            if (category) { url += `?cat=${category}`; } else { url += `?cat=all`; }
            if (statName) { url += `&stat=${statName}`; }
            return fetchApi(url);
        },
        // Added lookup to maintain feature parity if it was ever needed, though not in original user object
    },

    faction: {
        async basic(faction) {
            const endpoint = faction ? `https://api.torn.com/v2/faction/${faction}/basic` : `https://api.torn.com/v2/faction/basic`;
            const response = await fetchApi(endpoint);
            // v2 return structure: { basic: { ... } }
            const data = response.basic;

            const now = new Date();
            // Store by ID. If faction is null (own faction), we rely on data.id
            cache.factions[data.id] = {
                name: data.name,
                leader_id: data.leader_id,
                capacity: data.capacity,
                rank: data.rank,
                best_chain: data.best_chain,
                updated: now.toISOString()
            };
            saveCache();
            return data;
        },
        async members(faction) {
            const endpoint = faction ? `https://api.torn.com/v2/faction/${faction}/members?striptags=true` : `https://api.torn.com/v2/faction/members?striptags=true`;
            const data = await fetchApi(endpoint);
            return data.members;
        },
        async crimes(options = {}) {
            let params = new URLSearchParams();


            if (typeof options === 'string') {
                params.append('cat', options);
            } else {
                if (options.category) params.append('cat', options.category);
                if (options.from) params.append('from', options.from);
                if (options.to) params.append('to', options.to);
                if (options.limit) params.append('limit', options.limit);
                if (options.sort) params.append('sort', options.sort);
                if (options.offset !== undefined) params.append('offset', options.offset);
                if (options.initiator) params.append('initiator', options.initiator);
            }

            const endpoint = `https://api.torn.com/v2/faction/crimes`;
            const queryString = params.toString() ? `?${params.toString()}` : '';

            const data = await fetchApi(`${endpoint}${queryString}`);
            return data.crimes;
        },
        async upgrades() {
            const data = await fetchApi(`https://api.torn.com/v2/faction/upgrades`);
            return data;
        },
        async news(category, from) {
            const data = await fetchApi(`https://api.torn.com/v2/faction/news?striptags=false&limit=100&sort=DESC&from=${from}&cat=${category}`);
            return data.news;
        },
        async rankedWars(options = {}) {
            let params = new URLSearchParams();
            if (options.limit) params.append('limit', options.limit);
            if (options.offset !== undefined) params.append('offset', options.offset);
            if (options.sort) params.append('sort', options.sort);
            if (options.to) params.append('to', options.to);
            if (options.from) params.append('from', options.from);

            const queryString = params.toString() ? `?${params.toString()}` : '';
            const data = await fetchApi(`https://api.torn.com/v2/faction/rankedwars${queryString}`);
            return data.rankedwars;
        },
        async rankedWarReport(id) {
            const data = await fetchApi(`https://api.torn.com/v2/faction/${id}/rankedwarreport`);
            return data.rankedwarreport;
        }
    },

    // company was a top-level function in export, but also used as property
    // Original: module.exports.company = async ...
    // So api.company should be a function
    company: async (company) => {
        const endpoint = company ? `https://api.torn.com/company/${company}?selections=profile` : `https://api.torn.com/company/?selections=profile`;
        const data = await fetchApi(endpoint);
        const now = new Date();
        // company ID is data.company.ID
        cache.companies[data.company.ID] = {
            name: data.company.name,
            id: data.company.ID,
            company_type: data.company.company_type,
            director_id: data.company.director,
            rating: data.company.rating,
            updated: now.toISOString()
        };
        saveCache();
        return data.company;
    },

    // item was a function with a .lookup property
    item: Object.assign(
        async (item) => {
            const data = await fetchApi(`https://api.torn.com/v2/torn/${item}/items?sort=ASC`);
            const now = new Date();
            cache.items[item] = data.items[0]; // Assuming item is ID
            if (cache.items[item]) {
                cache.items[item].updated = now.toISOString();
            }
            saveCache();
            return data.items[0];
        },
        {
            lookup: async (itemName) => {
                console.debug(`Torn: Looking up item ${itemName}`);
                const now = new Date().getTime();

                // Check cache first
                for (const itemId in cache.items) {
                    if (cache.items[itemId].name === itemName) {
                        let last = 0;
                        try { last = new Date(cache.items[itemId].updated).getTime(); } catch (e) { }

                        if (now - last < TIME_30D) {
                            console.debug(`Cache: Hit for item ${cache.items[itemId].name}`);
                            return cache.items[itemId];
                        }
                    }
                }

                console.debug(`Cache: Miss for item ${itemName}`);
                const data = await fetchApi(`https://api.torn.com/v2/torn/items?cat=All&sort=ASC`);
                let target;
                if (data.items) {
                    data.items.forEach(item => {
                        if (item.name === itemName) {
                            console.debug(`Torn: Found item ${item.name} as ${item.id}`);
                            target = item;
                        }
                    });
                }

                if (target) {
                    cache.items[target.id] = target;
                    cache.items[target.id].updated = new Date().toISOString();
                    saveCache();
                }
                return target;
            }
        }
    ),

    self: {
        async id() {
            if (!config.tornid) {
                const url = `https://api.torn.com/user/?selections=basic&key=${config.torn}`;
                const response = await fetch(url);
                const data = await response.json();
                config.tornid = data.player_id;
                console.log(`Torn: Retrieved default ID as "${data.player_id}"`);
                return data.player_id;
            } else {
                return config.tornid;
            }
        }
    }
};

module.exports = api;