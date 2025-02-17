import { describe, expect, it, jest, afterAll, beforeAll, afterEach, beforeEach } from '@jest/globals';
import Keyv from 'keyv';

import CacheStorage from 'src/lib/cache';
import InMemory from 'src/lib/cache/in-memory';
import KeyvAdapter from 'src/lib/cache/keyv-adapter';
import { SCOPE_IP, SCOPE_RANGE } from 'src/lib/constants';
import logger from 'src/lib/logger';
import { CachableDecision } from 'src/lib/types';

let keyvAdapter: KeyvAdapter;

describe('Cache', () => {
    describe('KeyvAdapter', () => {
        beforeAll(() => {
            const storage = new Keyv();
            keyvAdapter = new KeyvAdapter(storage);
        });

        afterEach(async () => {
            jest.restoreAllMocks();
            await keyvAdapter.clear();
        });

        afterAll(async () => {
            jest.restoreAllMocks();
            await keyvAdapter.clear();
        });

        it('should be able to use KeyvAdapter', async () => {
            expect(keyvAdapter).toBeTruthy();

            // setItem and getItem test

            const item = await keyvAdapter.setItem({ key: 'test', content: 'test' });

            let result = await keyvAdapter.getItem('test');

            expect(result).toEqual(item);
            // deleteItem test
            const deleteItem = await keyvAdapter.deleteItem('test');

            expect(deleteItem).toBe(true);

            result = await keyvAdapter.getItem('test');

            expect(result).toBeNull();
            // clear test
            const item2 = await keyvAdapter.setItem({ key: 'test2', content: 'test2' });

            result = await keyvAdapter.getItem('test2');

            expect(result).toEqual(item2);

            const clear = await keyvAdapter.clear();

            expect(clear).toBe(true);

            result = await keyvAdapter.getItem('test2');

            expect(result).toBeNull();
        });
    });

    describe('CacheStorage - storeDecisions', () => {
        let cacheStorage: CacheStorage;
        let mockSetItem: jest.SpiedFunction<KeyvAdapter['setItem']>;

        beforeEach(() => {
            // ✅ Create an instance of CacheStorage with InMemory as the adapter
            const mockAdapter = new InMemory();
            cacheStorage = new CacheStorage({ cacheAdapter: mockAdapter });

            // ✅ Spy on setItem from KeyvAdapter, since InMemory extends it
            mockSetItem = jest.spyOn(KeyvAdapter.prototype, 'setItem') as jest.SpiedFunction<KeyvAdapter['setItem']>;
        });

        afterEach(async () => {
            jest.restoreAllMocks();
        });

        afterAll(async () => {
            jest.restoreAllMocks();
        });

        it('should store IP and Range decisions in cache', async () => {
            // Arrange: Define mock decisions
            const decisions: CachableDecision[] = [
                {
                    identifier: 'dec1-dec1-dec1-dec1',
                    scope: SCOPE_IP,
                    value: '192.168.0.1',
                    type: 'ban',
                    origin: 'test-origin',
                    expiresAt: Date.now() + 60000, // Expires in 1 minute
                },
                {
                    identifier: 'dec2-dec2-dec2-dec2',
                    scope: SCOPE_RANGE,
                    value: '192.168.0.0/24',
                    type: 'captcha',
                    origin: 'test-origin',
                    expiresAt: Date.now() + 60000, // Expires in 1 minute
                },
            ];

            // Act: Call storeDecisions
            const result = await cacheStorage.storeDecisions(decisions);

            // Assert: Check that it returns an array of CachableDecisionContent
            expect(result).toHaveLength(2);
            expect(result).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'dec1-dec1-dec1-dec1',
                        value: 'ban',
                        origin: 'test-origin',
                    }),
                    expect.objectContaining({
                        id: 'dec2-dec2-dec2-dec2',
                        value: 'captcha',
                        origin: 'test-origin',
                    }),
                ]),
            );

            // Ensure setItem was called for each decision + 1 for the range_bucket
            expect(mockSetItem).toHaveBeenCalledTimes(3);
        });

        it('should return an empty array if no decisions are provided', async () => {
            // Act: Call storeDecisions with an empty array
            const result = await cacheStorage.storeDecisions([]);

            // Assert: It should return an empty array
            expect(result).toEqual([]);
            expect(mockSetItem).not.toHaveBeenCalled();
        });
        it('should return an empty array if unknown scope', async () => {
            const decisions: CachableDecision[] = [
                {
                    identifier: 'dec1-dec1-dec1-dec1',
                    scope: 'unknown',
                    value: '192.168.0.1',
                    type: 'ban',
                    origin: 'test-origin',
                    expiresAt: Date.now() + 60000, // Expires in 1 minute
                },
            ];
            // Act: Call storeDecisions with an empty array
            const result = await cacheStorage.storeDecisions(decisions);

            // Assert: It should return an empty array
            expect(result).toEqual([]);
            expect(mockSetItem).not.toHaveBeenCalled();
        });
        it('should return an empty array if ipv6 range scope', async () => {
            const mockLoggerInfo = jest.spyOn(logger, 'error').mockImplementation(() => {});

            const decisions: CachableDecision[] = [
                {
                    identifier: 'dec1-dec1-dec1-dec1',
                    scope: SCOPE_RANGE,
                    value: '2001:0db8:85a3:0000:0000:8a2e:0370:7334/64',
                    type: 'ban',
                    origin: 'test-origin',
                    expiresAt: Date.now() + 60000, // Expires in 1 minute
                },
            ];
            // Act: Call storeDecisions with an empty array
            const result = await cacheStorage.storeDecisions(decisions);

            // Assert: It should return an empty array
            expect(result).toEqual([]);
            expect(mockSetItem).not.toHaveBeenCalled();

            expect(mockLoggerInfo).toHaveBeenCalledWith(
                'Error getting range of 2001:0db8:85a3:0000:0000:8a2e:0370:7334/64: Only Ip V4 Range format is supported.',
            );
        });
    });
    describe('CacheStorage - removeDecisions', () => {
        let cacheStorage: CacheStorage;

        beforeEach(() => {
            // Use real InMemory adapter so we actually store and remove data
            cacheStorage = new CacheStorage({ cacheAdapter: new InMemory() });
        });

        afterEach(async () => {
            await cacheStorage.adapter.clear();
        });

        afterAll(async () => {
            await cacheStorage.adapter.clear();
        });

        it('should remove multiple decisions from the cache and return removed items', async () => {
            // Arrange: Store decisions first
            const decisions: CachableDecision[] = [
                {
                    identifier: 'dec1-dec1-dec1-dec1',
                    scope: SCOPE_IP,
                    value: '192.168.0.1',
                    type: 'ban',
                    origin: 'test-origin',
                    expiresAt: Date.now() + 60000,
                },
                {
                    identifier: 'dec2-dec2-dec2-dec2',
                    scope: SCOPE_RANGE,
                    value: '192.168.0.0/24',
                    type: 'captcha',
                    origin: 'test-origin',
                    expiresAt: Date.now() + 60000,
                },
            ];

            await cacheStorage.storeDecisions(decisions);

            // Act: Remove decisions
            const removedDecisions = await cacheStorage.removeDecisions(decisions);

            // Assert: Verify that the decisions were removed
            expect(removedDecisions).toHaveLength(2);
            expect(removedDecisions).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        id: 'dec1-dec1-dec1-dec1',
                        value: 'ban',
                        origin: 'test-origin',
                    }),
                    expect.objectContaining({
                        id: 'dec2-dec2-dec2-dec2',
                        value: 'captcha',
                        origin: 'test-origin',
                    }),
                ]),
            );

            // Ensure cache no longer contains them
            const stillInCache1 = await cacheStorage.getAllCachableDecisionContents('192.168.0.1');
            const stillInCache2 = await cacheStorage.getAllCachableDecisionContents('192.168.0.0/24');

            expect(stillInCache1).toHaveLength(0);
            expect(stillInCache2).toHaveLength(0);
        });

        it('should return an empty array if no decisions are provided', async () => {
            // Act: Remove with empty array
            const result = await cacheStorage.removeDecisions([]);

            // Assert
            expect(result).toEqual([]);
        });

        it('should return an empty array for ipv6 range scoped decisions', async () => {
            const decisions: CachableDecision[] = [
                {
                    identifier: 'dec1-dec1-dec1-dec1',
                    scope: SCOPE_RANGE,
                    value: '2001:0db8:85a3:0000:0000:8a2e:0370:7334/64',
                    type: 'ban',
                    origin: 'test-origin',
                    expiresAt: Date.now() + 60000, // Expires in 1 minute
                },
            ];
            // Act: Remove with empty array
            const result = await cacheStorage.removeDecisions(decisions);

            // Assert
            expect(result).toEqual([]);
        });

        it('should return an empty array if unknown scope', async () => {
            const decisions: CachableDecision[] = [
                {
                    identifier: 'dec1-dec1-dec1-dec1',
                    scope: 'unknown',
                    value: '192.168.0.1',
                    type: 'ban',
                    origin: 'test-origin',
                    expiresAt: Date.now() + 60000,
                },
            ];
            // Act: Remove with empty array
            const result = await cacheStorage.removeDecisions(decisions);

            // Assert
            expect(result).toEqual([]);
        });

        it('should return only existing and non existing decisions', async () => {
            // Arrange: Store only one decision
            const storedDecisions: CachableDecision[] = [
                {
                    identifier: 'cscli-ban-ip-192.168.0.1',
                    scope: SCOPE_IP,
                    value: '192.168.0.1',
                    type: 'ban',
                    origin: 'cscli',
                    expiresAt: Date.now() + 60000,
                },
            ];

            await cacheStorage.storeDecisions(storedDecisions);

            const decisionsToRemove: CachableDecision[] = [
                storedDecisions[0], // Existing decision
                {
                    identifier: 'dec-missing-dec-dec',
                    scope: SCOPE_IP,
                    value: '10.0.0.1',
                    type: 'ban',
                    origin: 'test-origin',
                    expiresAt: Date.now() + 60000,
                },
            ];

            // Act: Remove decisions (one exists, one does not)
            const removedDecisions = await cacheStorage.removeDecisions(decisionsToRemove);

            // Assert: Only existing decision should be returned
            expect(removedDecisions).toHaveLength(2);
            expect(removedDecisions).toEqual([
                expect.objectContaining({
                    id: 'cscli-ban-ip-192.168.0.1',
                    value: 'ban',
                    origin: 'cscli',
                }),
                expect.objectContaining({
                    id: 'dec-missing-dec-dec',
                    value: 'ban',
                    origin: 'test-origin',
                }),
            ]);
        });
    });
    describe('CacheStorage - isWarm', () => {
        let cacheStorage: CacheStorage;

        beforeEach(() => {
            // ✅ Create an instance of CacheStorage with InMemory as the adapter
            const cacheAdapter = new InMemory();
            cacheStorage = new CacheStorage({ cacheAdapter });
        });

        afterEach(async () => {
            jest.restoreAllMocks();
        });

        afterAll(async () => {
            jest.restoreAllMocks();
        });

        it('should return false', async () => {
            jest.spyOn(cacheStorage['adapter'], 'getItem').mockResolvedValue(null);

            const result = await cacheStorage.isWarm();

            expect(result).toEqual(false);
        });

        it('should return true', async () => {
            jest.spyOn(cacheStorage['adapter'], 'getItem').mockResolvedValue({
                key: 'config_warmed_up',
                content: true,
            });

            const result = await cacheStorage.isWarm();

            expect(result).toEqual(true);
        });
    });
    describe('CacheStorage - upsertMetricsOriginsCount', () => {
        let cacheStorage: CacheStorage;

        beforeEach(() => {
            // ✅ Create an instance of CacheStorage with InMemory as the adapter
            const cacheAdapter = new InMemory();
            cacheStorage = new CacheStorage({ cacheAdapter });
        });

        afterEach(async () => {
            jest.restoreAllMocks();
        });

        afterAll(async () => {
            jest.restoreAllMocks();
        });

        it('should upsert cache item', async () => {
            let result = await cacheStorage.upsertMetricsOriginsCount({
                origin: 'test-origin',
                remediation: 'ban',
            });

            expect(result.content).toEqual([{ origin: 'test-origin', remediation: { ban: 1 } }]);

            result = await cacheStorage.upsertMetricsOriginsCount({
                origin: 'test-origin',
                remediation: 'ban',
            });

            expect(result.content).toEqual([{ origin: 'test-origin', remediation: { ban: 2 } }]);

            result = await cacheStorage.upsertMetricsOriginsCount({
                origin: 'test-origin',
                remediation: 'captcha',
            });

            expect(result.content).toEqual([{ origin: 'test-origin', remediation: { ban: 2, captcha: 1 } }]);

            result = await cacheStorage.upsertMetricsOriginsCount({
                origin: 'test-origin-2',
                remediation: 'captcha',
            });

            expect(result.content).toEqual([
                { origin: 'test-origin', remediation: { ban: 2, captcha: 1 } },
                { origin: 'test-origin-2', remediation: { captcha: 1 } },
            ]);

            result = await cacheStorage.upsertMetricsOriginsCount({
                origin: 'test-origin-2',
                remediation: 'custom',
            });

            expect(result.content).toEqual([
                { origin: 'test-origin', remediation: { ban: 2, captcha: 1 } },
                { origin: 'test-origin-2', remediation: { captcha: 1, custom: 1 } },
            ]);
        });
    });
});
