import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end guest journey. Requires the app running against a provisioned
 * Supabase database (real submissions are created and can be cleaned up in
 * the admin — names are prefixed "E2E" for easy identification).
 */

// There is no entrance gate any more — visitors land directly on the hero.
async function openSite(page: Page) {
  await page.goto("/");
}

async function fillName(page: Page, name: string) {
  await page.getByLabel(/your name/i).fill(name);
  await page.getByRole("button", { name: /continue/i }).click();
}

async function chooseEvent(
  page: Page,
  accept: boolean,
  clicksUp = 0,
) {
  if (accept) {
    await page.getByRole("button", { name: /accept with pleasure/i }).click();
    for (let i = 0; i < clicksUp; i++) {
      await page.getByRole("button", { name: /more guests/i }).click();
    }
  } else {
    await page.getByRole("button", { name: /unable to attend/i }).click();
  }
  await page.getByRole("button", { name: /^continue/i }).click();
}

test.describe("landing", () => {
  test("shows names, dates, and both events", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("Bilal Ahmad");
    await expect(heading).toContainText("Jennah Samhan");

    await expect(
      page.getByRole("heading", { name: /^henna$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^wedding$/i }),
    ).toBeVisible();
    await expect(page.getByText("Widdi Catering Hall")).toBeVisible();
    await expect(
      page.getByText("Hilton Garden Inn New York/Staten Island"),
    ).toBeVisible();
  });

  test("calendar downloads respond with valid ICS", async ({ request }) => {
    for (const slug of ["henna", "wedding"]) {
      const res = await request.get(`/api/calendar/${slug}`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("text/calendar");
      const body = await res.text();
      expect(body).toContain("BEGIN:VCALENDAR");
      expect(body).toContain("TZID=America/New_York");
    }
  });

  test("unknown calendar slug 404s", async ({ request }) => {
    const res = await request.get("/api/calendar/reception");
    expect(res.status()).toBe(404);
  });
});

test.describe("RSVP flow (requires database)", () => {
  test("accept both events with different counts, then manage", async ({
    page,
  }) => {
    const name = `E2E Both ${Date.now()}`;
    await openSite(page);
    await page.getByRole("link", { name: /the celebrations/i }).click();
    await fillName(page, name);

    // Henna: 4 guests (default 2 + 2 clicks)
    await chooseEvent(page, true, 2);
    // Wedding: 6 guests
    await chooseEvent(page, true, 4);

    // Names step (optional) — skip
    await page.getByRole("button", { name: /skip for now/i }).click();
    // Contact step — continue to review
    await page.getByRole("button", { name: /review/i }).click();

    await expect(page.getByText("Attending · 4 guests")).toBeVisible();
    await expect(page.getByText("Attending · 6 guests")).toBeVisible();

    await page.getByRole("button", { name: /confirm rsvp/i }).click();
    await expect(page.getByRole("heading", { name: /rsvp received/i })).toBeVisible({
      timeout: 15_000,
    });

    // Management link is offered
    const manageLink = page.locator('a[href^="/rsvp/manage/"]').first();
    await expect(manageLink).toBeVisible();
    const manageHref = await manageLink.getAttribute("href");
    expect(manageHref).toBeTruthy();

    // Modify the wedding count 6 → 3 on the manage page
    await page.goto(manageHref!);
    await expect(page.getByRole("heading", { name: /your rsvp/i })).toBeVisible();
    const weddingSize = page.locator("#size-wedding");
    await expect(weddingSize).toHaveValue("6");
    await weddingSize.fill("3");
    await expect(weddingSize).toHaveValue("3"); // ensure React state caught up
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page.getByText(/saved — thank you/i)).toBeVisible({
      timeout: 15_000,
    });

    // Persistence check
    await page.reload();
    await expect(page.locator("#size-wedding")).toHaveValue("3");
  });

  test("decline both events", async ({ page }) => {
    await openSite(page);
    await page.getByRole("link", { name: /the celebrations/i }).click();
    await fillName(page, `E2E Decline ${Date.now()}`);
    await chooseEvent(page, false);
    await chooseEvent(page, false);
    // No names step when declining everything — straight to contact
    await page.getByRole("button", { name: /review/i }).click();
    await expect(page.getByText(/unable to attend/i).first()).toBeVisible();
    await page.getByRole("button", { name: /confirm rsvp/i }).click();
    await expect(page.getByRole("heading", { name: /rsvp received/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("invalid manage token discloses nothing", async ({ page }) => {
    await page.goto("/rsvp/manage/definitely-not-a-real-token");
    await expect(page.getByText(/isn.t valid/i)).toBeVisible();
    await expect(page.locator("input")).toHaveCount(0);
  });
});

test.describe("admin", () => {
  test("unauthenticated /admin redirects to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("unauthenticated export API is blocked", async ({ request }) => {
    const res = await request.get("/api/admin/export");
    expect(res.status()).toBe(403);
  });
});
