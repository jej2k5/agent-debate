import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../src/claude_codex_debate/webui",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8710",
        changeOrigin: true,
      },
    },
  },
});
