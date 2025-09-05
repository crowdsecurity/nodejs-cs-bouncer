import { CACHE_SEPARATOR } from '../constants';

export const getCacheKey = (prefix: string, value: string): string => {
    const result = `${prefix}${CACHE_SEPARATOR}${value}`;
    /**
     * Replace unauthorized symbols.
     *
     * @see https://symfony.com/doc/current/components/cache/cache_items.html#cache-item-keys-and-values
     */
    return result.replace(/[^A-Za-z0-9_.]/g, CACHE_SEPARATOR);
};
