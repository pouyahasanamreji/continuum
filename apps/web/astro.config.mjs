// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  integrations: [react()],
  server: { host: true, port: 4321 },
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      watch: {
        usePolling: true,
        interval: 400,
        ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
      },
    },
  },
});
