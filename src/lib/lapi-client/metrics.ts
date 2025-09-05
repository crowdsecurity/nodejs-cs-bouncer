import { METRICS_TYPE } from '../constants';
import { CachableOrigin, Remediation } from '../types';
import os from 'os';

type MetricsProperties = {
    name: string;
    type: string;
    version: string;
    feature_flags: string[];
    utc_startup_timestamp: number;
    last_pull?: number;
    os?: {
        name: string;
        version: string;
    };
};

type MetricsMeta = {
    window_size_seconds: number;
    utc_now_timestamp: number;
};

export type MetricItem = {
    name: string;
    value: number;
    unit: string;
    labels?: {
        origin?: CachableOrigin;
        remediation?: Remediation;
    };
};

type BuildUsageMetricsParams = {
    properties: Partial<MetricsProperties>;
    meta: Partial<MetricsMeta>;
    items?: MetricItem[];
};

export type FinalMetrics = {
    remediation_components: (MetricsProperties & {
        metrics: {
            meta: MetricsMeta;
            items: MetricItem[];
        }[];
    })[];
};

class Metrics {
    format(): FinalMetrics {
        return {
            remediation_components: [
                {
                    ...this.properties,
                    metrics: [
                        {
                            meta: this.meta,
                            items: this.items,
                        },
                    ],
                },
            ],
        };
    }

    properties: MetricsProperties;
    meta: MetricsMeta;
    items: MetricItem[];

    constructor({ properties, meta, items }: { properties: MetricsProperties; meta: MetricsMeta; items: MetricItem[] }) {
        this.properties = properties;
        this.meta = meta;
        this.items = items;
    }
}

export class MetricsBuilder {
    public buildUsageMetrics(params: BuildUsageMetricsParams): Metrics {
        try {
            const { properties, meta, items } = params;
            const finalProperties: MetricsProperties = {
                name: properties.name ?? '',
                type: properties.type ?? METRICS_TYPE,
                version: properties.version ?? '',
                feature_flags: properties.feature_flags ?? [],
                utc_startup_timestamp: properties.utc_startup_timestamp ?? 0,
            };

            if (properties.last_pull !== undefined) {
                finalProperties.last_pull = properties.last_pull;
            }

            finalProperties.os = properties.os ?? {
                name: os.type(),
                version: os.release(),
            };

            const finalMeta: MetricsMeta = {
                window_size_seconds: meta.window_size_seconds ?? 0,
                utc_now_timestamp: meta.utc_now_timestamp ?? Math.floor(Date.now() / 1000),
            };

            return new Metrics({ properties: finalProperties, meta: finalMeta, items: items ?? [] });
        } catch (error) {
            throw new Error(`Something went wrong while creating metrics: ${error instanceof Error ? error.message : 'Unknown error.'}`);
        }
    }
}
