import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // Build with --mode pages for the GitHub Pages subdirectory.
  // Normal development/builds keep their original root path.
  base: mode === "pages" ? "/tacticlens-live/" : "/",
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true }
    }
  }
}));
