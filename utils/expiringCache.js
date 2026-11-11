class ExpiringCache {
    constructor({ maxEntries = 1000 } = {}) {
        this.maxEntries = maxEntries;
        this.entries = new Map();
    }

    get(key) {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry.value;
    }

    set(key, value, ttlMs) {
        this.entries.delete(key);
        if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value);
        this.entries.set(key, { value, expiresAt: Date.now() + ttlMs });
        return value;
    }

    delete(key) {
        this.entries.delete(key);
    }
}

module.exports = { ExpiringCache };
