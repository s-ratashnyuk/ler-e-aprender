const { defineConfig } = require("vite");
const react = require("@vitejs/plugin-react");

const config = defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8787"
    }
  }
});

module.exports = config;
