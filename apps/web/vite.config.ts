import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target:
          process.env.CODEMAP_API_URL ??
          `http://127.0.0.1:${process.env.CODEMAP_PORT ?? "4310"}`,
        changeOrigin: false,
      },
    },
  },
});
