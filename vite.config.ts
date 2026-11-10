import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
      cssFileName: "style",
    },
    rolldownOptions: {
      external: ["vue", "@lucide/vue"],
    },
    minify: false,
    sourcemap: false,
  },
});
