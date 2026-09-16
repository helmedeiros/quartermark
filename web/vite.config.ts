/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Loopback, and /api proxied straight through rather than enabled for
// cross-origin requests: a quarter plan names people and unshipped work,
// so the server should not accept requests from anywhere by default.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.QUARTERMARK_API_PORT ?? 8770}`,
        changeOrigin: false,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
  },
});
