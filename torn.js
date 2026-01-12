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
    cache = require('./data/cache.json');
} catch (e) {
    cache = {
        users: {},
        factions: {},
        companies: {},
        items: {}
    };
    try {
        const dir = './data';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync('./data/cache.json', JSON.stringify(cache));
    } catch (writeErr) {
        console.error("Failed to write initial cache.json", writeErr);
    }
}

// Constants
const HOURS = 60 * 60 * 1000;
const TTL = {
    USER: 12 * HOURS,
    FACTION: 12 * HOURS,
    COMPANY: 12 * HOURS,
    ITEM: 7 * 24 * HOURS,
    ITEM_LOOKUP: 30 * 24 * HOURS
};

// Helper to save cache
function saveCache() {
    try {
        const dir = './data';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync('./data/cache.json', JSON.stringify(cache));
    } catch (e) {
        console.error("Failed to save cache:", e);
    }
}

// Generic Caching Helper
async function getCached(collectionName, id, fetchFn, ttl, force = false) {
    const now = new Date().getTime();

    // Ensure nested object exists
    if (!cache[collectionName]) cache[collectionName] = {};

    const item = cache[collectionName][id];
    let lastUpdated = 0;

    if (item && item.updated) {
        try {
            lastUpdated = new Date(item.updated).getTime();
        } catch (e) {
            lastUpdated = 0;
        }
    }

    if (!force && item && (now - lastUpdated < ttl)) {
        console.debug(`Cache: Hit for ${collectionName} ${item.name || id}`);
        return item;
    } else {
        if (force) console.debug(`Cache: Force refresh for ${collectionName} ${id || 'unknown'}`);
        else console.debug(`Cache: Miss for ${collectionName} ${id || 'unknown'}`);

        try {
            const result = await fetchFn();
            console.debug(`Cache: Resolved ${collectionName} ${result.name || result.title || id}`);

            // Update cache with full result
            cache[collectionName][id] = {
                ...result,
                updated: new Date().toISOString()
            };
            saveCache();

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
        throw new Error(data.error.error || "Torn API Error");
    }
    return data;
}

const api = {
    self: {}, // Will be populated by readyCheck

    readyCheck: async (key) => {
        try {
            // Fetch own 'basic' data using V2 (which returns profile object)
            // By passing null/undefined as user, api.user.basic defaults to 'self' cache key
            const data = await api.user.basic(null, true);
            api.self = data;
            console.log(`Torn: Connected as ${data.name} [${data.player_id}]`);
        } catch (e) {
            console.error("Torn: Critical error during startup check", e);
        }
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

    user: {
        async basic(user, force = false) {
            const endpoint = user ? `https://api.torn.com/v2/user/${user}/basic` : `https://api.torn.com/v2/user/basic`;
            return getCached('users', user || 'self', async () => {
                const data = await fetchApi(endpoint);
                if (data.profile) data.profile.player_id = data.profile.id; // Shim for V1 compatibility
                return data.profile; // V2 wraps in 'profile'
            }, TTL.USER, force);
        },
        async profile(user, force = false) {
            const endpoint = user ? `https://api.torn.com/v2/user/${user}/profile` : `https://api.torn.com/v2/user/profile`;
            return getCached('users', user || 'self', async () => {
                const data = await fetchApi(endpoint);
                if (data.profile) data.profile.player_id = data.profile.id; // Shim for V1 compatibility
                return data.profile; // V2 wraps in 'profile'
            }, TTL.USER, force);
        },
        async stats(user, category, statName) {
            let url = `https://api.torn.com/v2/user`;
            if (user) { url += `/${user}/personalstats`; }
            if (category) { url += `?cat=${category}`; } else { url += `?cat=all`; }
            if (statName) { url += `&stat=${statName}`; }
            return fetchApi(url);
        },
        async job(user, force = false) {
            const endpoint = user ? `https://api.torn.com/v2/user/${user}/job` : `https://api.torn.com/v2/user/job`;
            return getCached('users_job', user || 'self', async () => {
                const data = await fetchApi(endpoint);
                return data.job;
            }, TTL.USER, force);
        },
        async faction(user, force = false) {
            const endpoint = user ? `https://api.torn.com/v2/user/${user}/faction` : `https://api.torn.com/v2/user/faction`;
            return getCached('users_faction', user || 'self', async () => {
                const data = await fetchApi(endpoint);
                return data.faction;
            }, TTL.USER, force);
        },
        async get(user, selections = [], force = false) {
            const selStr = selections.join(',');
            const endpoint = user ? `https://api.torn.com/v2/user/${user}?selections=${selStr}` : `https://api.torn.com/v2/user?selections=${selStr}`;
            // Cache usage for composite calls is tricky. For now, let's skip complex caching or cache by selection string key.
            // A simple key like "users_profile_job_faction_ID" works.
            const cacheKey = selections.sort().join('_');

            return getCached(`users_${cacheKey}`, user || 'self', async () => {
                const data = await fetchApi(endpoint);
                return data;
            }, TTL.USER, force);
        },
    },

    faction: {
        async basic(faction, force = false) {
            // If faction is null, we can't key by ID easily until we fetch.
            // For now, let's assume if faction is provided we use it as key.
            // If not provided, we might be fetching our own faction.
            // We can key it by "own" or similar if needed, but let's see.
            // If faction is missing, we fetch own faction, resulting data has ID.

            // Special handling: if faction is undefined, we can't check cache by ID easily without knowing ID.
            // However, we can use a special key like 'own' or skip cache check pre-fetch?
            // Better: If no ID provided, we just fetch to be safe, OR we assume config.factionID if we had it.
            // Let's implement transparent fetching without ID -> fetch -> cache by ID.

            if (!faction) {
                const endpoint = `https://api.torn.com/v2/faction/basic`;
                const response = await fetchApi(endpoint);
                const data = response.basic;
                // We can update cache here manually
                cache.factions[data.id] = { ...data, updated: new Date().toISOString() };
                saveCache();
                return data;
            }

            return getCached('factions', faction, async () => {
                const endpoint = `https://api.torn.com/v2/faction/${faction}/basic`;
                const response = await fetchApi(endpoint);
                return response.basic;
            }, TTL.FACTION, force);
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

    company: async (company, force = false) => {
        if (!company) {
            const endpoint = `https://api.torn.com/company/?selections=profile`;
            const data = await fetchApi(endpoint);
            // ID is data.company.ID 
            // Torn API v1/v2 difference? URL says /company/? so likely v1 standard structure
            // Let's assume data.company exists.
            if (data.company) {
                cache.companies[data.company.ID] = { ...data.company, updated: new Date().toISOString() };
                saveCache();
                return data.company;
            }
            return data;
        }

        return getCached('companies', company, async () => {
            const endpoint = `https://api.torn.com/company/${company}?selections=profile`;
            const data = await fetchApi(endpoint);
            return data.company;
        }, TTL.COMPANY, force);
    },

    // item was a function with a .lookup property
    item: Object.assign(
        async (item, force = false) => {
            return getCached('items', item, async () => {
                const data = await fetchApi(`https://api.torn.com/v2/torn/${item}/items?sort=ASC`);
                return data.items[0];
            }, TTL.ITEM, force);
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

                        if (now - last < TTL.ITEM_LOOKUP) {
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


};

module.exports = api;