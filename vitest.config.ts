import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vitest/config';

const resolveTsFromJs = {
  name: 'vorqul-resolve-ts-from-js',
  enforce: 'pre' as const,
  resolveId(source: string, importer?: string) {
    if (!importer || !source.startsWith('.') || !source.endsWith('.js')) return null;
    const candidate = path.resolve(path.dirname(importer), `${source.slice(0, -3)}.ts`);
    return fs.existsSync(candidate) ? candidate : null;
  },
};

export default defineConfig({
  plugins: [resolveTsFromJs],
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src/dashboard') },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
