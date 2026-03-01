import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/config/env.ts'],
    },
  },
  resolve: {
    alias: {
      // Strip .js extensions from imports so vitest can resolve .ts files
    },
  },
});
