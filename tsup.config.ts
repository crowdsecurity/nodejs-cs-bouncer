import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: ['esm'], // ESM-only
    dts: true, // generate dist/index.d.ts
    sourcemap: true,
    clean: true,
    platform: 'node',
    target: 'node20',
    splitting: false,
    treeshake: true,
    tsconfig: 'tsconfig.json',
    loader: { '.ejs': 'text' },
});
