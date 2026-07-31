import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const API_PORT = process.env.PORT || 8787;

export default defineConfig({
  plugins: [react()],
  server: {
    // Forward /api calls to the Express proxy during dev.
    proxy: {
      "/api": `http://localhost:${API_PORT}`,
    },
  },
});
