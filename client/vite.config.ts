import { defineConfig } from "vite";

const Config = defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787"
    }
  }
});

export default Config;
