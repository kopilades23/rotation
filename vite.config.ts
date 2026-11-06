import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` → app normale (Vercel).
// `npm run build:demo` → un seul fichier HTML autonome en mode démo (données locales).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  build: mode === 'demo' ? { outDir: 'dist-demo', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 4000 } : { chunkSizeWarningLimit: 1200 },
}));
