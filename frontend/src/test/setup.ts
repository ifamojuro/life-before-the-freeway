/**
 * Vitest setup — runs before every test file (see vite.config.ts `test`).
 *
 * - Registers Testing Library's jest-dom matchers (`toBeInTheDocument`, …).
 * - Unmounts rendered React trees after each test so they don't leak.
 */
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
