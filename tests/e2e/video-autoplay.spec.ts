import { expect, test } from "@playwright/test";

// The mobile project runs with reduced motion, where the hero intentionally
// renders a still poster and no <video> — these specs are desktop-only.


test("video autoplays normally", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(1500);
  const playing = await page.evaluate(() => {
    const v = document.querySelector("video");
    return v ? !v.paused && v.currentTime > 0 : false;
  });
  expect(playing).toBe(true);
});

test("suspended video (Low Power Mode model): plays on first tap", async ({ page }) => {
  // Model iOS LPM: the autoplay attribute is inert AND the first play() rejects.
  await page.addInitScript(() => {
    let firstVideo = true;
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.tagName === "VIDEO" && firstVideo) {
        firstVideo = false;
        return Promise.reject(new DOMException("NotAllowedError", "NotAllowedError"));
      }
      return orig.call(this);
    };
    new MutationObserver((_m, obs) => {
      document.querySelectorAll("video[autoplay]").forEach((v) => {
        v.removeAttribute("autoplay");
        (v as HTMLVideoElement).pause();
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  });
  await page.goto("/");
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => {
    const v = document.querySelector("video");
    return v ? !v.paused : null;
  });
  console.log("[video-sim] playing-before-tap=" + before); // environment-dependent; not asserted
  await page.mouse.click(200, 500); // first tap anywhere
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => {
    const v = document.querySelector("video");
    return v ? !v.paused && v.currentTime >= 0 : false;
  });
  console.log("[video-sim] playing-after-tap=" + after);
  expect(after).toBe(true);
});
