import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import fs from 'node:fs';
import path from 'node:path';

// Writes the service worker with the list of built files so the app works offline.
function serviceWorker(): Plugin {
  return {
    name: 'size-compare-service-worker',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist');
      const shell: string[] = ['./'];
      const walk = (dir: string) => {
        for (const f of fs.readdirSync(dir)) {
          const full = path.join(dir, f);
          const rel = path.relative(dist, full).split(path.sep).join('/');
          if (fs.statSync(full).isDirectory()) walk(full);
          else if (rel !== 'sw.js') shell.push(rel);
        }
      };
      walk(dist);
      const src = fs.readFileSync(path.resolve(__dirname, 'src/sw.template.js'), 'utf8')
        .replace('__VERSION__', Date.now().toString(36))
        .replace('__SHELL__', JSON.stringify(shell));
      fs.writeFileSync(path.join(dist, 'sw.js'), src);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [preact(), serviceWorker()],
  build: { target: 'es2020' },
});
