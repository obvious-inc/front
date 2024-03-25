import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  return {
    publicDir: "static",
    envPrefix: "PUBLIC_",
    plugins: [
      react({ jsxImportSource: "@emotion/react" }),
      VitePWA({ registerType: "autoUpdate" }),
    ],
    define: {
      "import.meta.env.EDGE_API_BASE_URL": JSON.stringify(
        // If there’s no edge api origin specified we proxy everything through /api
        env.EDGE_API_BASE_URL == null ? "/api" : "/edge-api",
      ),
    },
    server: {
      port: process.env.PORT ?? 8080,
      proxy: {
        "/api": {
          target: env.API_BASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/edge-api": {
          target: env.EDGE_API_BASE_URL,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/edge-api/, ""),
        },
      },
    },
  };
});
