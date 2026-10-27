import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// relative base so the built folder works on any static host (GitHub Pages, Netlify)
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
  },
});
