import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import type { PluginOption } from "vite";

// Lazy-import so visualizer is never instantiated during normal dev/build.
// Only active when the ANALYZE environment variable is set.
// Trigger: ANALYZE=true npm run build
// Windows:  set ANALYZE=true && npm run build
// Output:   dist/stats.html (treemap — gitignored, never shipped to production)
const visualizer = process.env.ANALYZE
  ? (await import("rollup-plugin-visualizer")).visualizer
  : null;

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve("src"),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(visualizer
      ? [
          visualizer({
            filename: "dist/stats.html",
            template: "treemap",
            gzipSize: true,
            brotliSize: true,
            // open: false on Windows — auto-open can invoke the wrong browser.
            // Open dist/stats.html manually after the build.
            open: false,
          }) as PluginOption,
        ]
      : []),
  ],
  server: {
    port: 5175,
    allowedHosts: ["port5175.kokhan.me"],
    // Polling is required for HMR when the source is bind-mounted from the
    // Windows filesystem into the Linux container — inotify events don't
    // cross that boundary, so file watching falls back to polling.
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
});
