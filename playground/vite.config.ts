import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";

const slowResource: Plugin = {
  name: "slow-resource",
  configureServer(server) {
    server.middlewares.use("/stalled", (_req, res) => {
      const timer = setTimeout(() => {
        res.setHeader("Content-Type", "application/json");
        res.end("{}");
      }, 60000);
      res.on("close", () => clearTimeout(timer));
    });
  },
};

export default defineConfig({
  root: import.meta.dirname,
  server: { host: "127.0.0.1", port: 5189, strictPort: true },
  plugins: [vue(), slowResource],
});
