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

test("the map stays where you left it after opening a story", async ({ page }) => {
  await skipFirstVisit(page);
  await page.goto("/");
  const pin = mapPins(page).first();
  await expect(pin).toBeVisible();

  // Drag the map, then note where the pin ended up on screen.
  const map = page.getByLabel("Map of West Oakland");
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 - 60, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(800); // let the drag's inertia finish
  const before = (await pin.boundingBox())!;

  await pin.click();
  await expect(page).toHaveURL(/\/story\/\d+/);
  await page.getByRole("button", { name: "Close and return to map" }).click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);

  // Compare the pin's tip (bottom center): the pin you came back from is drawn larger.
  const after = (await mapPins(page).first().boundingBox())!;
  expect(Math.abs(after.x + after.width / 2 - (before.x + before.width / 2))).toBeLessThan(2);
  expect(Math.abs(after.y + after.height - (before.y + before.height))).toBeLessThan(2);
});
