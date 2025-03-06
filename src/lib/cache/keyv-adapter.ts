import { createCache } from 'cache-manager';
// @ts-expect-error - Keyv is a CommonJS module, TypeScript expects a different import style
import { Keyv } from 'keyv';

import { CacheAdapter } from 'src/lib/cache/interfaces';
import { CachableItem } from 'src/lib/cache/types';

type CacheAdapterType = ReturnType<typeof createCache>;

class KeyvAdapter implements CacheAdapter {
    private readonly adapter: CacheAdapterType;

    constructor(storage: Keyv) {
        this.adapter = createCache({
            stores: [storage],
        });
    }

    async getItem(key: string): Promise<CachableItem | null> {
        const content = await this.adapter.get(key);
        return content ? { key, content } : null;
    }

    async setItem(item: CachableItem, ttl?: number): Promise<CachableItem> {
        await this.adapter.set(item.key, item.content, ttl);
        return item;
    }

    async deleteItem(key: string): Promise<boolean> {
        return this.adapter.del(key);
    }

    async clear(): Promise<boolean> {
        return this.adapter.clear();
    }
}

export default KeyvAdapter;
