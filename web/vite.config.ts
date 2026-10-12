/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Adresse publique du site dans index.html (aperçu des liens partagés : il faut une URL absolue). */
function publicUrl(): Plugin {
  return {
    name: "vif-public-url",
    transformIndexHtml(html, ctx) {
      const env = loadEnv(ctx.server ? "development" : "production", "..", "VITE_");
      return html.replaceAll("__PUBLIC_URL__", process.env.VITE_PUBLIC_URL || env.VITE_PUBLIC_URL || "");
    },
  };
}

// Un seul .env.local à la racine du dépôt, partagé avec l'API.
export default defineConfig({
  envDir: "..",
  plugins: [react(), publicUrl()],
  build: {
    rollupOptions: {
      output: {
        // Bibliothèques dans des fichiers à part : elles changent rarement et restent en cache
        // sur le téléphone d'une mise à jour du site à l'autre.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"],
          firebase: ["firebase/app", "firebase/auth"],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Accessible depuis un téléphone sur le même Wi-Fi (http://<ip-de-l-ordinateur>:5173).
    host: true,
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
