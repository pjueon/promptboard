import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.{test,spec}.ts'],
    exclude: ['tests/e2e/**/*'],
    mockReset: false,
    unstubGlobals: true,
    server: {
      deps: {
        // Externalize canvas to prevent vitest from trying to load the native module
        external: ['canvas'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.spec.ts',
        '**/*.test.ts',
      ],
      // 80% coverage goal
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Mock canvas to avoid native module loading in tests
      canvas: fileURLToPath(new URL('./__mocks__/canvas.ts', import.meta.url)),
    },
  },
});
