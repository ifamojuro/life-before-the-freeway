import { expect, test } from "@playwright/test";
import { mapPins, skipFirstVisit } from "./helpers";

test("first visit shows the welcome overlay until dismissed", async ({ page }) => {
  await page.goto("/");
  const welcome = page.getByRole("dialog", { name: "Welcome" });
  await expect(welcome).toBeVisible();
  await welcome.getByRole("button", { name: "Next" }).click();
  await welcome.getByRole("button", { name: "Start exploring" }).click();
  await expect(welcome).toBeHidden();

  await page.reload();
  await expect(mapPins(page).first()).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Welcome" })).toBeHidden();
});

test("the map shows story pins, and a pin opens its stories", async ({ page }) => {
  await skipFirstVisit(page);
  await page.goto("/");

  const pins = mapPins(page);
  await expect(pins.first()).toBeVisible();
  expect(await pins.count()).toBeGreaterThan(1);

  const label = (await pins.first().getAttribute("aria-label")) ?? "";
  const place = label.split(" · ")[0];
  await pins.first().click();

  await expect(page).toHaveURL(/\/story\/\d+/);
  const story = page.getByRole("dialog", { name: place });
  await expect(story.getByRole("heading", { name: place })).toBeVisible();
  await expect(story.getByRole("heading", { name: /^Reflections/ })).toBeVisible();

  await story.getByRole("button", { name: "Close and return to map" }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
});
