import { configDefaults, defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Auth.js uses Next's extensionless server imports; let Vite resolve them.
    server: { deps: { inline: ['next-auth'] } },
    exclude: [...configDefaults.exclude, '**/.tmp/**', '**/out/**', '**/.next/**'],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      MONGODB_URI: 'mongodb://localhost:27017/test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
