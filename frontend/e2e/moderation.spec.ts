import { expect, test, type Page } from "@playwright/test";

// Seeded staff account from the sample archive (see backend/app/seed.py).
async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("randolph@lbtf.org");
  await page.getByLabel("Password").fill("admin");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Moderation queue/ })).toBeVisible();
}

function tabCount(page: Page, tab: string) {
  return page.getByRole("tab", { name: new RegExp(`^${tab}`) }).locator(".c");
}

test("staff sign in with a wrong password is refused", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".adm-err")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("approving a pending submission publishes it and logs who did it", async ({ page }) => {
  await signIn(page);

  const pending = Number(await tabCount(page, "Pending").innerText());
  const approved = Number(await tabCount(page, "Approved").innerText());
  expect(pending).toBeGreaterThan(0);

  const card = page.locator(".qcard").first();
  const label = (await card.locator(".qloc").innerText()).trim();
  await card.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByRole("status")).toHaveText("Approved & published to the map");
  await expect(tabCount(page, "Pending")).toHaveText(String(pending - 1));
  await expect(tabCount(page, "Approved")).toHaveText(String(approved + 1));

  // The audit log records the decision under the reviewer's name.
  const row = page.locator(".audit-table tbody tr", { hasText: label }).first();
  await expect(row).toContainText("Approved");
  await expect(row).toContainText("Randolph");
});

test("rejecting asks for confirmation and moves the submission to Rejected", async ({ page }) => {
  await signIn(page);
  const rejected = Number(await tabCount(page, "Rejected").innerText());

  page.once("dialog", (d) => void d.accept());
  await page.locator(".qcard").first().getByRole("button", { name: "Reject" }).click();

  await expect(page.getByRole("status")).toHaveText("Rejected");
  await expect(tabCount(page, "Rejected")).toHaveText(String(rejected + 1));
});
