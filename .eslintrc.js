module.exports = {
    env: {
        browser: true,
        es2021: true,
    },
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:import/recommended', 'plugin:import/typescript'],
    overrides: [
        {
            env: {
                node: true,
            },
            files: ['.eslintrc.js'],
            parserOptions: {
                sourceType: 'script',
            },
        },
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    settings: {
        'import/resolver': {
            typescript: {
                alwaysTryTypes: true,
                project: './tsconfig.json',
            },
        },
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx'],
        },
    },
    rules: {
        'import/no-unresolved': 'error',
        'import/order': [
            'error',
            {
                groups: ['external', ['builtin', 'index', 'sibling', 'parent', 'internal'], 'object', 'type'],
                'newlines-between': 'always',
                alphabetize: { order: 'asc', caseInsensitive: true },
            },
        ],
        'no-relative-import-paths/no-relative-import-paths': ['error', { allowSameFolder: false }],
        'prefer-arrow-functions/prefer-arrow-functions': [
            'error',
            {
                allowNamedFunctions: false,
                classPropertiesAllowed: false,
                disallowPrototype: false,
                returnStyle: 'unchanged',
                singleReturnOnly: false,
            },
        ],
        'prefer-template': 'error',
        'no-nested-ternary': 'error',
    },
    ignorePatterns: ['**/*.ejs', 'dist/'],
    plugins: ['@typescript-eslint', 'prefer-arrow-functions', 'eslint-plugin-import', 'no-relative-import-paths'],
};
