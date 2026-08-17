import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages project sites are served from /<repo>/ — the deploy workflow sets
// VITE_BASE. Local dev and user/org pages stay at "/".
const base = resolveBase();

/**
 * Validates VITE_BASE loudly.
 *
 * Git Bash on Windows rewrites a leading-slash argument into a Windows path, so
 * `VITE_BASE=/ghi-chu/ npm run build` silently produces a bundle pointing at
 * `/Program Files/Git/ghi-chu/`. That deploys and 404s with no clue why, so it
 * is worth failing the build instead.
 */
function resolveBase(): string {
  const raw = process.env.VITE_BASE;
  if (!raw) return "/";
  if (/^\/[^/]/.test(raw) || raw === "/") {
    return raw.endsWith("/") ? raw : `${raw}/`;
  }
  throw new Error(
    `VITE_BASE phải có dạng "/ten-repo/" nhưng nhận được "${raw}".\n` +
      `Trên Git Bash (Windows), dùng PowerShell hoặc đặt MSYS_NO_PATHCONV=1 để tránh bị đổi thành đường dẫn Windows.`
  );
}

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // No includeAssets: globPatterns below already covers png/svg, and
      // listing them twice puts duplicate entries in the precache manifest.
      manifest: {
        name: "Ghi chú hàng ngày",
        short_name: "Ghi chú",
        description:
          "Checklist và ghi chú hàng ngày — chạy offline, đồng bộ qua GitHub",
        lang: "vi",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#ffffff",
        theme_color: "#059669",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // The app shell is precached and nothing else is cached at runtime:
        // data lives in IndexedDB, and GitHub API responses must always be
        // fetched fresh or sync would reconcile against a stale copy.
        runtimeCaching: [],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    sourcemap: false,
    // Dependencies change far less often than the app does. Splitting them out
    // means a routine update re-downloads tens of KB over mobile data instead
    // of the whole bundle, since the service worker only refetches what moved.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Left unassigned so they stay inside the dynamically imported
          // Markdown chunk — otherwise they land in vendor and get parsed on
          // startup even though a note preview is a deliberate action.
          if (id.includes("marked") || id.includes("dompurify")) return undefined;
          if (id.includes("minisearch")) return "search";
          if (id.includes("lucide-react")) return "icons";
          return "vendor";
        },
      },
    },
    chunkSizeWarningLimit: 400,
  },
  server: {
    host: true,
    port: 5173,
  },
});
