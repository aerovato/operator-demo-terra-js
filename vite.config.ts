import { defineConfig } from 'vite';

// base must match the GitHub Pages subpath; harmless for local dev.
export default defineConfig({
  base: '/operator-demo-terra-js/',
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
