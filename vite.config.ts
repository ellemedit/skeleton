import { defineConfig } from "vite";

// Plain Vite config: the demo entry is the root index.html, which loads
// demo/main.ts. The library code under src/ is imported directly by the demo.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
