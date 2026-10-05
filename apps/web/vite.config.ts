import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function portFromEnvironment(name: string, fallback: number): number {
  const raw = process.env[name];
  const port = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer from 1 to 65535`);
  }
  return port;
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: portFromEnvironment('CODEMAP_WEB_PORT', 5173),
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${portFromEnvironment('CODEMAP_PORT', 4310)}`,
    },
  },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
});
