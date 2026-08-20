import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API runs on :8000 (uvicorn). Both /api and /uploads are proxied so the
// frontend can use relative URLs in dev and behind one origin in prod.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/uploads": "http://localhost:8000",
    },
  },
});
