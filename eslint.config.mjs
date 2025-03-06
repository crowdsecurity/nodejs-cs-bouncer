import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import _import from 'eslint-plugin-import';
import noRelativeImportPaths from 'eslint-plugin-no-relative-import-paths';
import preferArrowFunctions from 'eslint-plugin-prefer-arrow-functions';
import globals from 'globals';

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

export default [
    {
        ignores: process.env.CI ? ['**/*.ejs', '**/dist/', '**/examples'] : ['**/*.ejs', '**/dist/'],
    },
    ...fixupConfigRules(
        compat.extends(
            'eslint:recommended',
            'plugin:@typescript-eslint/recommended',
            'plugin:import/recommended',
            'plugin:import/typescript',
        ),
    ),
    {
        plugins: {
            '@typescript-eslint': fixupPluginRules(typescriptEslint),
            'prefer-arrow-functions': preferArrowFunctions,
            import: fixupPluginRules(_import),
            'no-relative-import-paths': noRelativeImportPaths,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
            },

            parser: tsParser,
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
                    alphabetize: {
                        order: 'asc',
                        caseInsensitive: true,
                    },
                },
            ],

            'no-relative-import-paths/no-relative-import-paths': [
                'error',
                {
                    allowSameFolder: false,
                },
            ],

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
            'no-implicit-coercion': ['error', { boolean: true }],

            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'typeLike',
                    format: ['PascalCase'],
                },
                {
                    selector: 'enum',
                    format: ['UPPER_CASE'],
                },
            ],
        },
    },
    {
        files: ['**/.eslintrc.js'],

        languageOptions: {
            globals: {
                ...globals.node,
            },

            ecmaVersion: 5,
            sourceType: 'commonjs',
        },
    },
];
