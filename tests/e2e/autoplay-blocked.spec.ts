import { expect, test } from "@playwright/test";
test("simulated strict policy: first play() rejected, recovery on first tap", async ({ page }) => {
  // Model a strict browser: the initial autoplay attempt is rejected;
  // any later (gesture-driven) attempt succeeds.
  await page.addInitScript(() => {
    let first = true;
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (first) {
        first = false;
        return Promise.reject(new DOMException("NotAllowedError", "NotAllowedError"));
      }
      return orig.call(this);
    };
  });
  await page.goto("/");
  await page.waitForTimeout(1800);
  const btn = page.getByRole("button", { name: /pause music|play music/i });
  const before = await btn.getAttribute("aria-pressed");
  console.log("[strict-sim] before-interaction=" + before);
  expect(before).toBe("false"); // honest UI while blocked
  await page.mouse.click(200, 400); // first tap anywhere on the page
  await expect(btn).toHaveAttribute("aria-pressed", "true", { timeout: 8000 });
  console.log("[strict-sim] after-first-click=true");
});
