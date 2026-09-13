import { test, type Page } from "@playwright/test";

/**
 * Guestbook visual audit capture — not assertions. Run with:
 *   npx playwright test tests/visual/guestbook.spec.ts --config=tests/visual/shots.config.ts
 * Screenshots land in tests/visual/out/.
 */

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1920x1080", width: 1920, height: 1080 },
];

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

async function mockApis(page: Page, opts: { delayMs?: number } = {}) {
  await page.route("**/api/guestbook/upload-session", (route) =>
    route.fulfill({
      json: {
        ok: true,
        uploadUrl:
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=vqa",
        thumbnailUploadUrl: null,
      },
    }),
  );
  await page.route("https://www.googleapis.com/upload/**", async (route) => {
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "vqa-file" }),
    });
  });
  await page.route("**/api/guestbook/complete", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
}

for (const vp of VIEWPORTS) {
  test(`guestbook welcome ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/guestbook?event=wedding");
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: `tests/visual/out/gb-welcome-${vp.name}.png`,
      fullPage: true,
    });
  });
}

test("guestbook photo preview 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApis(page);
  await page.goto("/guestbook?event=henna");
  await page
    .locator('input[type="file"][accept^="image"]')
    .setInputFiles({ name: "a.png", mimeType: "image/png", buffer: TINY_PNG });
  await page.getByRole("heading", { name: /your memory/i }).waitFor();
  await page.getByLabel(/your name/i).fill("Amal & Family");
  await page
    .getByLabel(/a short note/i)
    .fill("Mabrouk habibi! We are so happy for you both.");
  await page.waitForTimeout(800);
  await page.screenshot({
    path: "tests/visual/out/gb-preview-390.png",
    fullPage: true,
  });
});

test("guestbook uploading 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApis(page, { delayMs: 6000 });
  await page.goto("/guestbook?event=wedding");
  await page
    .locator('input[type="file"][accept^="image"]')
    .setInputFiles({ name: "a.png", mimeType: "image/png", buffer: TINY_PNG });
  await page.getByRole("button", { name: /upload photo/i }).click();
  await page.getByRole("heading", { name: /uploading your memory/i }).waitFor();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "tests/visual/out/gb-uploading-390.png" });
});

test("guestbook success 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApis(page);
  await page.goto("/guestbook?event=wedding");
  await page
    .locator('input[type="file"][accept^="image"]')
    .setInputFiles({ name: "a.png", mimeType: "image/png", buffer: TINY_PNG });
  await page.getByRole("button", { name: /upload photo/i }).click();
  await page.getByRole("heading", { name: /memory saved/i }).waitFor();
  await page.waitForTimeout(2200); // let the tatreez stitch draw
  await page.screenshot({ path: "tests/visual/out/gb-success-390.png" });
});

test("guestbook video preview 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApis(page);
  await page.goto("/guestbook");
  await page
    .locator('input[type="file"][accept^="video/mp4"]')
    .setInputFiles("public/video/hero-embroidery.mp4");
  await page.getByRole("heading", { name: /your memory/i }).waitFor();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: "tests/visual/out/gb-video-preview-390.png",
    fullPage: true,
  });
});

for (const route of ["privacy", "terms"] as const) {
  for (const vp of [VIEWPORTS[2]!, VIEWPORTS[5]!]) {
    test(`${route} ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`/${route}`);
      await page.waitForTimeout(600);
      await page.screenshot({
        path: `tests/visual/out/${route}-${vp.name}.png`,
        fullPage: true,
      });
    });
  }
}
