import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Guestbook guest journeys with the network mocked at the app's API boundary
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

const MSG_CARD = /leave us a message/i;
const DUMP_CARD = /share photos & videos/i;

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

async function openMessageLane(page: Page, query = "") {
  await page.goto(`/guestbook${query}`);
  await page.getByRole("button", { name: MSG_CARD }).click();
  await expect(
    page.getByRole("heading", { name: /leave us a message/i }),
  ).toBeVisible();
}

async function openDumpLane(page: Page, query = "") {
  await page.goto(`/guestbook${query}`);
  await page.getByRole("button", { name: DUMP_CARD }).click();
  await expect(
    page.getByRole("heading", { name: /share photos & videos/i }),
  ).toBeVisible();
}

test.describe("guestbook — welcome", () => {
  test("shows both lanes", async ({ page }) => {
    await page.goto("/guestbook");
    await expect(
      page.getByRole("heading", { name: /share a memory/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: MSG_CARD })).toBeVisible();
    await expect(page.getByRole("button", { name: DUMP_CARD })).toBeVisible();
  });

  test("message lane shows actions and event choice", async ({ page }) => {
    await openMessageLane(page);
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

  test("?event=henna preselects Henna in the message lane", async ({ page }) => {
    await openMessageLane(page, "?event=henna");
    await expect(page.getByRole("radio", { name: "Henna" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("?event=wedding preselects Wedding in both lanes", async ({ page }) => {
    await openMessageLane(page, "?event=wedding");
    await expect(page.getByRole("radio", { name: "Wedding" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await openDumpLane(page, "?event=wedding");
    await expect(page.getByRole("radio", { name: "Wedding" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});

test.describe("guestbook — message flow", () => {
  test("photo: select → preview → details → upload → success", async ({
    page,
  }) => {
    await mockUploadApis(page);
    await openMessageLane(page, "?event=wedding");

    await page
      .locator('input[type="file"][accept^="image"]:not([multiple])')
      .setInputFiles({
        name: "family.png",
        mimeType: "image/png",
        buffer: TINY_PNG,
      });

    await expect(
      page.getByRole("heading", { name: /your memory/i }),
    ).toBeVisible();
    await expect(
      page.getByAltText(/preview of your selected photo/i),
    ).toBeVisible();

    await page.getByLabel(/your name/i).fill("E2E Guest");
    await page.getByLabel(/a short note/i).fill("Mabrouk from the E2E suite!");
    await page.getByRole("button", { name: /upload photo/i }).click();

    await expect(
      page.getByRole("heading", { name: /memory saved/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: /share more memories/i }),
    ).toBeVisible();
  });

  test("share more memories returns to the welcome chooser", async ({
    page,
  }) => {
    await mockUploadApis(page);
    await openMessageLane(page, "?event=wedding");
    await page
      .locator('input[type="file"][accept^="image"]:not([multiple])')
      .setInputFiles({ name: "a.png", mimeType: "image/png", buffer: TINY_PNG });
    await page.getByRole("button", { name: /upload photo/i }).click();
    await page
      .getByRole("button", { name: /share more memories/i })
      .click({ timeout: 20_000 });
    await expect(
      page.getByRole("heading", { name: /share a memory/i }),
    ).toBeVisible();
  });

  test("video: select → preview shows duration → upload → success", async ({
    page,
  }) => {
    await mockUploadApis(page);
    await openMessageLane(page);

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

test.describe("guestbook — batch dump flow", () => {
  test("multi-select → review grid → upload → success", async ({ page }) => {
    await mockUploadApis(page);
    await openDumpLane(page, "?event=wedding");

    await page.locator('input[type="file"][multiple]').setInputFiles([
      { name: "dance.png", mimeType: "image/png", buffer: TINY_PNG },
      {
        name: "clip.mp4",
        mimeType: "video/mp4",
        buffer: readFileSync(VIDEO_FIXTURE),
      },
    ]);

    await expect(page.getByText(/2 memories selected/i)).toBeVisible({
      timeout: 15_000,
    });
    await page.getByLabel(/your name/i).fill("E2E Batch Guest");
    await page.getByLabel(/a short note/i).fill("From the dance floor!");
    await page.getByRole("button", { name: /upload 2 memories/i }).click();

    await expect(
      page.getByRole("heading", { name: /memories saved/i }),
    ).toBeVisible({ timeout: 40_000 });
    await expect(page.getByText(/2 memories from the celebration/i)).toBeVisible();
  });

  test("oversized files are marked rejected and excluded from the count", async ({
    page,
  }) => {
    await openDumpLane(page);
    await page.locator('input[type="file"][multiple]').setInputFiles([
      { name: "ok.png", mimeType: "image/png", buffer: TINY_PNG },
      {
        name: "huge.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(26 * 1024 * 1024, 7),
      },
    ]);
    await expect(page.getByText(/1 memory selected/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/1 file can't be uploaded/i)).toBeVisible();
    await expect(page.getByText(/too large/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /upload 1 memory$/i }),
    ).toBeVisible();
  });

  test("selecting videos never blocks the review screen", async ({ page }) => {
    // Regression: metadata used to be probed synchronously per video before
    // the grid appeared, which on a real phone forces the OS to export every
    // file out of Photos (iCloud download included) and froze the selection
    // screen for minutes with the Upload button disabled the whole time.
    // Probing is now backgrounded, so the batch must be uploadable at once.
    await openDumpLane(page);
    const video = {
      name: "clip.mp4",
      mimeType: "video/mp4",
      buffer: readFileSync(VIDEO_FIXTURE),
    };
    await page.locator('input[type="file"][multiple]').setInputFiles([
      { ...video, name: "clip-a.mp4" },
      { ...video, name: "clip-b.mp4" },
      { name: "dance.png", mimeType: "image/png", buffer: TINY_PNG },
    ]);

    // Tight timeouts: these must be true immediately, not after probing.
    await expect(
      page.getByRole("button", { name: /upload 3 memories/i }),
    ).toBeEnabled({ timeout: 2_000 });
    await expect(page.getByText(/preparing your files/i)).toHaveCount(0);
  });

  test("items can be removed before uploading", async ({ page }) => {
    await openDumpLane(page);
    await page.locator('input[type="file"][multiple]').setInputFiles([
      { name: "one.png", mimeType: "image/png", buffer: TINY_PNG },
      { name: "two.png", mimeType: "image/png", buffer: TINY_PNG },
    ]);
    await expect(page.getByText(/2 memories selected/i)).toBeVisible();
    await page.getByRole("button", { name: /remove one\.png/i }).click();
    await expect(page.getByText(/1 memory selected/i)).toBeVisible();
  });
});

test.describe("guestbook — validation", () => {
  test("oversized message photo is rejected before upload", async ({ page }) => {
    await openMessageLane(page);
    await page
      .locator('input[type="file"][accept^="image"]:not([multiple])')
      .setInputFiles({
        name: "huge.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(26 * 1024 * 1024, 7),
      });
    await expect(
      page.getByRole("alert").filter({ hasText: /too large/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /leave us a message/i }),
    ).toBeVisible();
  });

  test("wrong file type is rejected with a friendly message", async ({
    page,
  }) => {
    await openMessageLane(page);
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
    await openMessageLane(page);
    await page
      .locator('input[type="file"][accept^="image"]:not([multiple])')
      .setInputFiles({ name: "a.png", mimeType: "image/png", buffer: TINY_PNG });
    await page.getByRole("button", { name: /upload photo/i }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /temporarily unavailable/i }),
    ).toBeVisible({ timeout: 15_000 });
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
