import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    setupFiles: ['./test/setup.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // e2e testlar bitta test DB'ni bo'lishadi — fayllar ketma-ket ishlaydi.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
  plugins: [tsconfigPaths(), swc.vite({ module: { type: 'es6' } })],
});
