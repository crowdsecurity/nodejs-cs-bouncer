// jest.config.mjs
import { createDefaultEsmPreset } from 'ts-jest';

/** @type {import('jest').Config} */
const esmPreset = createDefaultEsmPreset();

export default {
    ...esmPreset,

    // merge the preset's "transform" with our own rule
    transform: {
        ...esmPreset.transform,
        '\\.ejs$': '<rootDir>/jest-ejs-transform.cjs',
    },

    collectCoverage: true,
    coverageReporters: ['text', 'cobertura'],
    testEnvironment: 'node',
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/examples/'],

    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
    },
};
