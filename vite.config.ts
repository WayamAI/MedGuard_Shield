import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  build: {
    /*
     * NOT the default "assets".
     *
     * The app has a route at /assets (the asset inventory), and Vite's default
     * output directory produces a real `dist/assets/` folder. Served by nginx
     * that directory wins: a request for /assets gets a 301 to /assets/ and
     * the page never loads. Renaming the build output removes the collision
     * at the source rather than papering over it in the web-server config.
     */
    assetsDir: "static",
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
