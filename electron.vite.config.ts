import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), tsconfigPaths()],
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/main/index.ts")
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin(), tsconfigPaths()],
    build: {
      rollupOptions: {
        input: {
          index: resolve("src/preload/index.ts")
        },
        output: {
          format: "cjs",
          entryFileNames: "index.cjs"
        }
      }
    }
  },
  renderer: {
    root: ".",
    plugins: [react(), tailwindcss(), tsconfigPaths()],
    build: {
      rollupOptions: {
        input: {
          index: resolve("index.html")
        }
      }
    }
  }
});
