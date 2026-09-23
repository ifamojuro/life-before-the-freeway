import { expect, test } from "@playwright/test";
import { skipFirstVisit } from "./helpers";

// The e2e API runs with LBTF_USE_CLAUDE=0, so answers are extractive: quoted
// straight from the retrieved interview excerpts. Deterministic, no API key.

test.beforeEach(async ({ page }) => {
  await skipFirstVisit(page);
  await page.goto("/");
});

test("a suggested question gets an answer that cites stories", async ({ page }) => {
  const chat = page.getByRole("region", { name: "Ask the archive" });
  await chat.getByRole("button", { name: "What was on 7th Street?" }).click();

  await expect(chat.getByText("What was on 7th Street?")).toBeVisible();
  await expect(chat.getByText("Drawn from these stories")).toBeVisible();
  await expect(chat.getByText("Quoted from interviews")).toBeVisible();

  // Citations open the story they came from.
  await chat.locator(".cite-pin").first().click();
  await expect(page).toHaveURL(/\/story\/\d+\?from=chat/);
});

test("a question the interviews don't cover says so instead of guessing", async ({ page }) => {
  const chat = page.getByRole("region", { name: "Ask the archive" });
  await chat.getByRole("textbox", { name: "Your question" }).fill("What is the capital of Mongolia?");
  await chat.getByRole("button", { name: "Send" }).click();

  await expect(chat.getByText(/interviews don't cover that yet/)).toBeVisible();
  await expect(chat.getByText("Drawn from these stories")).toBeHidden();
});
