import type { Page } from "@playwright/test";

/** Mark the first-visit overlay as already seen, so it doesn't cover the page. */
export async function skipFirstVisit(page: Page) {
  await page.addInitScript(() => localStorage.setItem("lbtf.firstVisitDone", "1"));
}

/** Map pins are buttons labelled "<place> · <n> stories". */
export function mapPins(page: Page) {
  return page.getByRole("button", { name: /· \d+ stor(y|ies)$/ });
}
