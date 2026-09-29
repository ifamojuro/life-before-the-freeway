import { expect, test } from "@playwright/test";

// Chromium runs with a fake camera + microphone (see playwright.config.ts), so
// the real getUserMedia + MediaRecorder path runs. The e2e API uses the mock
// transcriber, which returns a canned transcript that mentions known places.

const NAME = "E2E Test Contributor";

test("record a story, place it, and submit it for moderation", async ({ page }) => {
  await page.goto("/contribute?layout=desktop");
  await expect(page.getByRole("heading", { name: "Your video" })).toBeVisible();

  // Record ~2 seconds from the fake camera.
  const record = page.getByRole("button", { name: "Start recording" });
  await expect(record).toBeEnabled();
  await record.click();
  await page.waitForTimeout(2_000);
  await page.getByRole("button", { name: "Stop recording" }).click();

  // Regression (PR #2): the recorded clip must actually load for playback,
  // not stay blocked behind the stopped camera stream.
  const playback = page.locator(".rec-frame video[controls]");
  await expect(playback).toHaveAttribute("src", /^blob:/);
  await expect.poll(() => playback.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);

  // Uploading transcribes the clip and lists the places it mentions.
  await page.getByRole("button", { name: "Use this video →" }).click();
  await expect(page.getByRole("heading", { name: "Places you mentioned" })).toBeVisible();
  await expect(page.locator(".dtc-place:not(.add)").first()).toBeVisible();
  await page.getByRole("button", { name: "Continue →" }).click();

  await expect(page.getByRole("heading", { name: "Which eras did you talk about?" })).toBeVisible();
  const era = page.locator(".dtc-era").first();
  await era.click();
  await expect(era).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Continue →" }).click();

  // Submitting needs a name and agreement to the community norms.
  const submit = page.getByRole("button", { name: "Submit my story" });
  await expect(submit).toBeDisabled();
  await page.getByPlaceholder("Denise Watkins").fill(NAME);
  await page.getByPlaceholder("you@email.com").fill("e2e@example.com");
  await page.getByRole("button", { name: /sharing from my own memory/ }).click();
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByRole("heading", { name: /Thank you for\s*sharing your story/ })).toBeVisible();
  await expect(page.getByText("We'll email e2e@example.com once it's live.")).toBeVisible();

  // The story is not public yet: it waits in the moderation queue.
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("randolph@lbtf.org");
  await page.getByLabel("Password").fill("admin");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("textbox", { name: "Search" }).fill(NAME);
  await expect(page.locator(".qcard")).toHaveCount(1);
  await page.locator(".qcard .qmeta").click();
  await expect(page.getByText(NAME)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve & publish" })).toBeVisible();
});
