import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.OKCLAW_VITE_BASE ?? "/",
  plugins: [react()],
  server: {
    port: 5173,
    open: false
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./vitest.setup.ts",
    css: true
  }
});
