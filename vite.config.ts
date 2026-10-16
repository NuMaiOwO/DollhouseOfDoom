import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths so the build works when uploaded to itch.io.
  base: "./",
  // Phaser alone is ~1.2 MB minified; that's expected.
  build: { chunkSizeWarningLimit: 1600 },
});
