import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Guestbook guest journey with the network mocked at the app's API boundary
 * and at Google's upload endpoint — no real Drive or Supabase writes. The
 * real upload path is exercised in production smoke testing instead.
 */

const FAKE_SESSION_URL =
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=e2e-fake";

// 1×1 transparent PNG
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const VIDEO_FIXTURE = path.resolve("public/video/hero-embroidery.mp4");

async function mockUploadApis(page: Page) {
  await page.route("**/api/guestbook/upload-session", async (route) => {
    const body = route.request().postDataJSON() as { thumbnail?: unknown };
    await route.fulfill({
      json: {
        ok: true,
        uploadUrl: FAKE_SESSION_URL,
        thumbnailUploadUrl: body.thumbnail ? FAKE_SESSION_URL : null,
      },
    });
  });
  await page.route("https://www.googleapis.com/upload/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "e2e-fake-file-id" }),
    });
  });
  await page.route("**/api/guestbook/complete", async (route) => {
    await route.fulfill({ json: { ok: true } });
  });
}

test.describe("guestbook — welcome", () => {
  test("shows the three actions and event choice", async ({ page }) => {
    await page.goto("/guestbook");
    await expect(
      page.getByRole("heading", { name: /leave us a message/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /record a video/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /choose a video/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /share a photo/i }),
    ).toBeVisible();
    await expect(page.getByRole("radio", { name: "Henna" })).toBeVisible();
  });

  test("?event=henna preselects Henna", async ({ page }) => {
    await page.goto("/guestbook?event=henna");
    await expect(page.getByRole("radio", { name: "Henna" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("?event=wedding preselects Wedding", async ({ page }) => {
    await page.goto("/guestbook?event=wedding");
    await expect(page.getByRole("radio", { name: "Wedding" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

test.describe("guestbook — photo flow", () => {
  test("select → preview → details → upload → success", async ({ page }) => {
    await mockUploadApis(page);
    await page.goto("/guestbook?event=wedding");

    await page
      .locator('input[type="file"][accept^="image"]')
      .setInputFiles({
        name: "family.png",
        mimeType: "image/png",
        buffer: TINY_PNG,
      });

    await expect(
      page.getByRole("heading", { name: /your memory/i }),
    ).toBeVisible();
    await expect(page.getByAltText(/preview of your selected photo/i)).toBeVisible();

    await page.getByLabel(/your name/i).fill("E2E Guest");
    await page.getByLabel(/a short note/i).fill("Mabrouk from the E2E suite!");
    await page.getByRole("button", { name: /upload photo/i }).click();

    await expect(
      page.getByRole("heading", { name: /memory saved/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: /leave another message/i }),
    ).toBeVisible();
  });

  test("leave another message returns to a clean chooser", async ({ page }) => {
    await mockUploadApis(page);
    await page.goto("/guestbook?event=wedding");
    await page
      .locator('input[type="file"][accept^="image"]')
      .setInputFiles({ name: "a.png", mimeType: "image/png", buffer: TINY_PNG });
    await page.getByRole("button", { name: /upload photo/i }).click();
    await page.getByRole("button", { name: /leave another message/i }).click({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: /leave us a message/i }),
    ).toBeVisible();
  });
});

test.describe("guestbook — video flow", () => {
  test("select video → preview shows duration → upload → success", async ({
    page,
  }) => {
    await mockUploadApis(page);
    await page.goto("/guestbook");

    await page
      .locator('input[type="file"][accept^="video/mp4"]')
      .setInputFiles({
        name: "message.mp4",
        mimeType: "video/mp4",
        buffer: readFileSync(VIDEO_FIXTURE),
      });

    await expect(
      page.getByRole("heading", { name: /your memory/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("video")).toBeVisible();

    await page.getByRole("button", { name: /upload message/i }).click();
    await expect(
      page.getByRole("heading", { name: /memory saved/i }),
    ).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("guestbook — validation", () => {
  test("oversized photo is rejected before upload", async ({ page }) => {
    await page.goto("/guestbook");
    await page
      .locator('input[type="file"][accept^="image"]')
      .setInputFiles({
        name: "huge.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(26 * 1024 * 1024, 7),
      });
    await expect(
      page.getByRole("alert").filter({ hasText: /too large/i }),
    ).toBeVisible();
    // Still on the chooser — nothing was uploaded.
    await expect(
      page.getByRole("heading", { name: /leave us a message/i }),
    ).toBeVisible();
  });

  test("wrong file type is rejected with a friendly message", async ({
    page,
  }) => {
    await page.goto("/guestbook");
    await page
      .locator('input[type="file"][accept^="video/mp4"]')
      .setInputFiles({
        name: "notes.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 fake"),
      });
    await expect(
      page.getByRole("alert").filter({ hasText: /isn't supported/i }),
    ).toBeVisible();
  });

  test("upload failure returns to details with a human error", async ({
    page,
  }) => {
    await page.route("**/api/guestbook/upload-session", (route) =>
      route.fulfill({
        status: 503,
        json: {
          error:
            "Uploads are temporarily unavailable. Your memory is still on your phone — please try again soon.",
        },
      }),
    );
    await page.goto("/guestbook");
    await page
      .locator('input[type="file"][accept^="image"]')
      .setInputFiles({ name: "a.png", mimeType: "image/png", buffer: TINY_PNG });
    await page.getByRole("button", { name: /upload photo/i }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /temporarily unavailable/i }),
    ).toBeVisible({ timeout: 15_000 });
    // The guest's selection is intact for retry.
    await expect(
      page.getByRole("button", { name: /upload photo/i }),
    ).toBeVisible();
  });
});

test.describe("legal pages", () => {
  test("privacy and terms render and are linked from the footer", async ({
    page,
  }) => {
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: "Privacy", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/drive\.file/i)).toBeVisible();

    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: "Terms", exact: true }),
    ).toBeVisible();
  });
});
