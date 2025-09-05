import KeyvStore from 'keyv';

import type { CacheAdapter } from './interfaces';
import type { CachableItem } from './types';

class KeyvAdapter implements CacheAdapter {
    private readonly storage: KeyvStore;

    constructor(storage: KeyvStore) {
        this.storage = storage;
    }

    async getItem(key: string): Promise<CachableItem | null> {
        const content = await this.storage.get(key);
        return content === undefined || content === null ? null : { key, content };
    }

    async setItem(item: CachableItem, ttl?: number): Promise<CachableItem> {
        await this.storage.set(item.key, item.content, ttl);
        return item;
    }

    async deleteItem(key: string): Promise<boolean> {
        return this.storage.delete(key);
    }

    async clear(): Promise<boolean> {
        await this.storage.clear();
        return true;
    }
}

export default KeyvAdapter;
