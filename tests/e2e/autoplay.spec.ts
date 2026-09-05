import { expect, test } from "@playwright/test";
test("music: autoplay or first-interaction recovery", async ({ page, browserName }) => {
  await page.goto("/");
  await page.waitForTimeout(1800);
  const btn = page.getByRole("button", { name: /pause music|play music/i });
  const before = await btn.getAttribute("aria-pressed");
  // Interact anywhere (not on the sound button itself)
  await page.mouse.click(200, 400);
  await expect(btn).toHaveAttribute("aria-pressed", "true", { timeout: 8000 });
  console.log(`[autoplay:${browserName}] before-interaction=${before} after-interaction=true`);
});
