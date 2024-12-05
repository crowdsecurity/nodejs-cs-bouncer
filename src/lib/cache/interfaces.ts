import { CachableItem } from 'src/lib/cache/types';

export interface CacheAdapter {
    /**
     * Retrieves an item from the cache.
     * @param key - The key of the item to retrieve.
     * @returns A promise which resolves to the cached item or null if not found.
     */
    getItem(key: string): Promise<CachableItem | null>;

    /**
     * Sets an item in the cache.
     * @param item
     * @param ttl - The time-to-live in milliseconds.
     * @returns A promise which resolves to the cached item.
     */
    setItem(item: CachableItem, ttl?: number): Promise<CachableItem>;

    /**
     * Deletes an item from the cache.
     * @param key
     * @returns A promise which resolves to `true` if the key existed, `false` if not.
     */
    deleteItem(key: string): Promise<boolean>;

    /**
     * Clears the cache.
     * @returns A promise which resolves to `true` if the cache was cleared successfully
     */
    clear(): Promise<boolean>;
}
