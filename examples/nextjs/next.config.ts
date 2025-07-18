// next.config.ts
import path from 'node:path';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    experimental: {
        nodeMiddleware: true, // ← enable Node.js middleware support
    },
    webpack(config, { isServer }) {
        if (isServer) {
            config.plugins = config.plugins || [];
            config.plugins.push(
                new CopyWebpackPlugin({
                    patterns: [
                        {
                            from: path.resolve(__dirname, 'node_modules/svg-captcha-fixed/fonts'),
                            to: path.resolve(__dirname, '.next/server/fonts'),
                        },
                    ],
                }),
            );
        }
        return config;
    },
};

export default nextConfig;
