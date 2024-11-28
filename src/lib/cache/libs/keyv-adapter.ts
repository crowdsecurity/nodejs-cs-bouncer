import { createCache } from 'cache-manager';
// @ts-expect-error - Keyv is a CommonJS module, TypeScript expects a different import style
import { Keyv } from 'keyv';

import { CacheAdapter } from 'src/lib/cache/libs/interfaces';
import { CachedItem } from 'src/lib/cache/libs/types';

type CacheAdapterType = ReturnType<typeof createCache>;

class KeyvAdapter implements CacheAdapter {
    private adapter: CacheAdapterType;

    constructor(storage: Keyv) {
        this.adapter = createCache({
            stores: [storage],
        });
    }

    async getItem(key: string): Promise<CachedItem | null> {
        return { key, content: await this.adapter.get(key) };
    }

    async setItem(item: CachedItem, ttl?: number): Promise<CachedItem> {
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
