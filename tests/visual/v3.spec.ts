import { test } from "@playwright/test";
test("mobile hero portrait video", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForTimeout(5600);
  await page.screenshot({ path: "tests/visual/out/v3-hero-390.png" });
});
test("events numeral + footer moon 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#events").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "tests/visual/out/v3-events-390.png" });
  const wedding = page.getByRole("heading", { name: /^wedding$/i });
  await wedding.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -160));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "tests/visual/out/v3-wedding-390.png" });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "tests/visual/out/v3-footer-390.png" });
});
test("rsvp wording + desktop nav 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "tests/visual/out/v3-hero-1440.png" });
  await page.locator("#rsvp").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  await page.getByLabel(/your name/i).fill("");
  await page.screenshot({ path: "tests/visual/out/v3-rsvp-1440.png" });
  await page.getByLabel(/your name/i).fill("Visual QA");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: "tests/visual/out/v3-rsvp-event-1440.png" });
});
