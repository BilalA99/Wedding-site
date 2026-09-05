import { test } from "@playwright/test";
const VPS = [
  { name: "320", width: 320, height: 568 },
  { name: "390", width: 390, height: 844 },
  { name: "768", width: 768, height: 1024 },
  { name: "1440", width: 1440, height: 900 },
];
for (const vp of VPS) {
  test(`divider ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");
    await page.locator("#events").scrollIntoViewIfNeeded();
    await page.getByRole("heading", { name: /^henna$/i }).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -120));
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `tests/visual/out/div-henna-${vp.name}.png` });
  });
}
