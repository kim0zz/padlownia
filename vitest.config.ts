import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: [
    { find: /^@padlownia\/domain$/, replacement: fileURLToPath(new URL('./packages/domain/src/index.ts', import.meta.url)) },
    { find: /^@padlownia\/database$/, replacement: fileURLToPath(new URL('./packages/database/src/index.ts', import.meta.url)) },
  ] },
  test: { include: ['tests/**/*.test.ts'], exclude: ['tests/e2e/**'], testTimeout: 30000, hookTimeout: 60000, maxWorkers: 2 },
});
