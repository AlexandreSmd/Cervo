/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Un seul .env.local à la racine du dépôt, partagé avec l'API.
export default defineConfig({
  envDir: "..",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // En local, Vite joue le rôle du Worker Cloudflare : /api/* → API FastAPI.
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
  },
  preview: { port: 5173, proxy: { "/api": "http://127.0.0.1:8000" } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
