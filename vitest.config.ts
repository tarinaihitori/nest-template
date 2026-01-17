import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    env: {
      DATABASE_URL: 'file:./dev.db',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  plugins: [swc.vite()],
});
