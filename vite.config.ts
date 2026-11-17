import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: [
            "@codemirror/state",
            "@codemirror/view",
            "@codemirror/commands",
            "@codemirror/language",
            "@codemirror/autocomplete",
            "@codemirror/search",
            "@lezer/highlight",
          ],
          langs: [
            "@codemirror/lang-html",
            "@codemirror/lang-css",
            "@codemirror/lang-javascript",
            "@codemirror/lang-json",
          ],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Allow the sandbox preview host (*.e2b.app) and any tunneled origin.
    allowedHosts: true,
    hmr: {
      clientPort: 443,
      protocol: "wss",
    },
  },
});
