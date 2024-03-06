import type { Config } from 'jest';

const config: Config = {
    collectCoverage: true,
    coverageReporters: ['text', 'cobertura'],
    preset: 'ts-jest',
    testEnvironment: 'node',
    testPathIgnorePatterns: ['/node_modules/', '/dist/'],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },
    moduleNameMapper: {
        '^src/(.*)$': '<rootDir>/src/$1',
    },
};

export default config;
