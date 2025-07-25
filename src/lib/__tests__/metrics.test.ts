import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { METRICS_TYPE } from '../constants';
import { MetricsBuilder } from '../lapi-client/metrics';
import os from 'os';

jest.mock('os', () => ({
    type: jest.fn(() => 'Linux'),
    release: jest.fn(() => '5.10.0'),
}));

describe('MetricsBuilder', () => {
    let metricsBuilder: MetricsBuilder;

    beforeEach(() => {
        metricsBuilder = new MetricsBuilder();
    });

    it('should build metrics with default values', () => {
        const result = metricsBuilder.buildUsageMetrics({ properties: {}, meta: {} });

        expect(result).toBeDefined();
        expect(result.properties).toEqual({
            name: '',
            type: METRICS_TYPE,
            version: '',
            feature_flags: [],
            utc_startup_timestamp: 0,
            os: { name: 'Linux', version: '5.10.0' },
        });
        expect(result.meta).toEqual({
            window_size_seconds: 0,
            utc_now_timestamp: expect.any(Number),
        });
        expect(result.items).toEqual([]);
    });

    it('should build metrics with provided values', () => {
        const params = {
            properties: {
                name: 'test',
                type: 'custom-type',
                version: '1.0.0',
                feature_flags: ['feature1'],
                utc_startup_timestamp: 123456,
                last_pull: 654321,
                os: { name: 'Windows', version: '10.0.0' },
            },
            meta: {
                window_size_seconds: 30,
                utc_now_timestamp: 987654,
            },
            items: [{ name: 'metric1', value: 10, unit: 'ms' }],
        };

        const result = metricsBuilder.buildUsageMetrics(params);

        expect(result.properties).toEqual({
            name: 'test',
            type: 'custom-type',
            version: '1.0.0',
            feature_flags: ['feature1'],
            utc_startup_timestamp: 123456,
            last_pull: 654321,
            os: { name: 'Windows', version: '10.0.0' },
        });
        expect(result.meta).toEqual({
            window_size_seconds: 30,
            utc_now_timestamp: 987654,
        });
        expect(result.items).toEqual([{ name: 'metric1', value: 10, unit: 'ms' }]);

        const finalMetrics = result.format();

        expect(finalMetrics).toEqual({
            remediation_components: [
                {
                    ...params.properties,
                    metrics: [
                        {
                            meta: params.meta,
                            items: params.items,
                        },
                    ],
                },
            ],
        });
    });

    it('should handle missing last_pull field', () => {
        const params = {
            properties: {
                name: 'test',
                type: 'custom-type',
                version: '1.0.0',
                feature_flags: ['feature1'],
                utc_startup_timestamp: 123456,
            },
            meta: { window_size_seconds: 30 },
        };

        const result = metricsBuilder.buildUsageMetrics(params);

        expect(result.properties.last_pull).toBeUndefined();
    });

    it('should handle errors when creating metrics', () => {
        const params = {
            properties: {
                name: 'test',
                type: 'custom-type',
                version: '1.0.0',
                feature_flags: ['feature1'],
                utc_startup_timestamp: 123456,
                last_pull: 654321,
                // Do not provide an OS object to trigger the default behavior
            },
            meta: {
                window_size_seconds: 30,
                utc_now_timestamp: 987654,
            },
            items: [{ name: 'metric1', value: 10, unit: 'ms' }],
        };

        jest.spyOn(os, 'type').mockImplementation(() => {
            throw new Error('OS error');
        });

        const metricsBuilder = new MetricsBuilder();
        expect(() => metricsBuilder.buildUsageMetrics(params)).toThrow('Something went wrong while creating metrics: OS error');

        jest.restoreAllMocks(); // Clean up the mock after the test
    });

    it('should handle unexpected errors when creating metrics', () => {
        const params = {
            properties: {
                name: 'test',
                type: 'custom-type',
                version: '1.0.0',
                feature_flags: ['feature1'],
                utc_startup_timestamp: 123456,
                last_pull: 654321,
                // Do not provide an OS object to trigger the default behavior
            },
            meta: {
                window_size_seconds: 30,
                utc_now_timestamp: 987654,
            },
            items: [{ name: 'metric1', value: 10, unit: 'ms' }],
        };

        jest.spyOn(os, 'type').mockImplementation(() => {
            throw 'OS error';
        });

        const metricsBuilder = new MetricsBuilder();
        expect(() => metricsBuilder.buildUsageMetrics(params)).toThrow('Something went wrong while creating metrics: Unknown error');

        jest.restoreAllMocks(); // Clean up the mock after the test
    });
});
