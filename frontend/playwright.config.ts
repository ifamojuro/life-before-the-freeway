import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// End-to-end tests drive the real app in Chromium: a fresh API on :8100 (its
// own SQLite file, sample archive, no Claude) behind a Vite dev server on
// :5273. Different ports from `make dev` / `npm run dev`, so both can run
// while you develop. Run with `npm run e2e` (or `make e2e` from the repo root).
const backend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../backend");
const API_PORT = 8100;
const WEB_PORT = 5273;

export default defineConfig({
  testDir: "./e2e",
  // Tests share one database (e.g. moderation changes the queue), so run them
  // one at a time in a fixed order.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        // A fake camera + microphone so the in-browser recorder can run.
        permissions: ["camera", "microphone"],
        launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
      },
    },
  ],
  webServer: [
    {
      // Start from an empty database every run; the app migrates and seeds it.
      command: `rm -rf e2e.db e2e-uploads && make setup && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: backend,
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        LBTF_DATABASE_URL: `sqlite:///${path.join(backend, "e2e.db")}`,
        LBTF_UPLOAD_DIR: path.join(backend, "e2e-uploads"),
        LBTF_SEED: "sample",
        LBTF_USE_CLAUDE: "0",
        LBTF_TRANSCRIBER: "mock",
        LBTF_SITE_PASSWORD: "",
      },
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { LBTF_API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
