import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const config = defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787"
    }
  }
});

export default config;
