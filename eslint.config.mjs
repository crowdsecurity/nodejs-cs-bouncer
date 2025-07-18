import { fixupConfigRules, fixupPluginRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import eslintImport from 'eslint-plugin-import';
import preferArrowFunctions from 'eslint-plugin-prefer-arrow-functions';
import jestPlugin from 'eslint-plugin-jest';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jestGlobals = jestPlugin.envs?.['jest/globals']?.globals ?? jestPlugin.environments?.['jest/globals']?.globals ?? {};

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

const shared = {
    plugins: {
        '@typescript-eslint': fixupPluginRules(typescriptEslint),
        'prefer-arrow-functions': preferArrowFunctions,
        import: fixupPluginRules(eslintImport),
    },

    languageOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        globals: { ...globals.node },
        parserOptions: {
            project: path.join(__dirname, 'tsconfig.json'),
            tsconfigRootDir: __dirname,
        },
    },

    settings: {
        'import/resolver': {
            node: { extensions: ['.js', '.mjs', '.ts'] },
            typescript: {
                project: [path.join(__dirname, 'tsconfig.json'), path.join(__dirname, 'tsconfig.spec.json')],
                alwaysTryTypes: true,
            },
        },
        'import/parsers': {
            '@typescript-eslint/parser': ['.ts', '.tsx'],
        },
    },

    rules: {
        'import/no-unresolved': 'error',
        'import/extensions': ['error', 'ignorePackages', { ts: 'never', tsx: 'never', js: 'never', mjs: 'never' }],
        'import/order': [
            'error',
            {
                groups: ['external', ['builtin', 'index', 'sibling', 'parent', 'internal'], 'object', 'type'],
                alphabetize: { order: 'asc', caseInsensitive: true },
                'newlines-between': 'always',
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
            { selector: 'typeLike', format: ['PascalCase'] },
            { selector: 'enum', format: ['UPPER_CASE'] },
        ],
    },
};

export default [
    {
        ignores: ['**/*.ejs', '**/dist/**', '**/examples/**', 'eslint.config.mjs', 'jest.config.mjs'],
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
        files: ['**/*.ts', '**/*.tsx'],
        ...shared,
    },

    {
        files: ['tests/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
        plugins: { ...shared.plugins, jest: jestPlugin },
        languageOptions: {
            ...shared.languageOptions,
            globals: { ...shared.languageOptions.globals, ...jestGlobals },
        },
        settings: shared.settings,
        rules: {
            ...shared.rules,
            'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
        },
    },

    {
        files: ['*.config.{ts,js,mjs,cjs}'],
        languageOptions: {
            ...shared.languageOptions,
            parserOptions: { project: null },
        },
        rules: { 'import/no-unresolved': 'off' },
    },

    {
        files: ['jest-ejs-transform.cjs'],
        languageOptions: {
            sourceType: 'script',
            globals: {
                module: 'readonly',
                exports: 'readonly',
                require: 'readonly',
            },
        },
        rules: { 'no-undef': 'off' },
    },
];
