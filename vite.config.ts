/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const listFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });

/** Po buildu vygeneruje dist/sw.js se seznamem všech souborů k uložení do cache. */
const serviceWorker = (): Plugin => {
  let outDir = 'dist';
  return {
    name: 'cls-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const skip = new Set(['sw.js']);
      const files = listFiles(outDir).filter((path) => !skip.has(relative(outDir, path)));
      const hash = createHash('sha256');
      const urls = files.map((path) => {
        hash.update(readFileSync(path));
        return `/${relative(outDir, path).split(sep).join('/')}`;
      });
      const template = readFileSync('scripts/sw-template.js', 'utf8');
      const sw = template
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__PRECACHE__', JSON.stringify(urls.sort(), null, 2));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
};

export default defineConfig({
  plugins: [react(), serviceWorker()],
  build: { target: 'es2020' },
  test: { environment: 'node' },
});
