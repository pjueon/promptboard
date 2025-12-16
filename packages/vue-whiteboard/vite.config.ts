import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'VueWhiteboard',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['vue', 'fabric', '@promptboard/core-whiteboard'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    }
  }
});
