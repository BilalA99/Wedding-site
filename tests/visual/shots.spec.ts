import { test } from "@playwright/test";

/**
 * Visual audit capture — not assertions. Run with:
 *   npx playwright test tests/visual --config=tests/visual/shots.config.ts
 * Screenshots land in tests/visual/out/.
 */

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "414x896", width: 414, height: 896 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

for (const vp of VIEWPORTS) {
  test(`hero ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");
    await page.waitForTimeout(3400); // allow entry choreography to finish
    await page.screenshot({ path: `tests/visual/out/hero-${vp.name}.png` });
  });
}

test("sections mobile 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForTimeout(1200);
  await page.locator("#events").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "tests/visual/out/events-390.png" });
  await page.getByRole("heading", { name: /^wedding$/i }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "tests/visual/out/wedding-390.png" });
  await page.locator("#rsvp").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "tests/visual/out/rsvp-390.png" });
  // RSVP event step
  await page.getByLabel(/your name/i).fill("Visual QA");
  await page.getByRole("button", { name: /continue/i }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: "tests/visual/out/rsvp-event-390.png" });
});

test("sections desktop 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForTimeout(1200);
  await page.locator("#events").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "tests/visual/out/events-1440.png" });
  await page.locator("#rsvp").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "tests/visual/out/rsvp-1440.png" });
});

test("footer + nav scrolled 1440", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "tests/visual/out/footer-1440.png" });
});
