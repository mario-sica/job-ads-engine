import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

// Il .env sta nella root del monorepo: da lì si legge la porta del backend.
const rootDir = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const apiPort = loadEnv(mode, rootDir, "PORT").PORT || "3000";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { "/api": `http://localhost:${apiPort}` },
    },
  };
});
