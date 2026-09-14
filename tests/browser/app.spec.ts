import { test, expect } from "@playwright/test";
test("setup page and private routes fail closed without credentials", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Owner sign in" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in →", exact: true }),
  ).toBeDisabled();
  const response = await request.get("/api/brain");
  expect([401, 503]).toContain(response.status());
});
test("demo navigation, output download, capture, context, and removal", async ({
  page,
}) => {
  await page.goto("/?demo=1");
  await expect(page.getByText("DEMO MODE", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Read output ↗" }).click();
  await expect(
    page.getByRole("heading", { name: "Test two opening shots" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Markdown" }).click();
  expect((await download).suggestedFilename()).toBe("experiment.md");
  await page.getByRole("button", { name: "＋ Quick capture" }).click();
  await page
    .getByLabel("Source text or transcript")
    .fill("Use close-ups to establish visual texture.");
  await page.getByLabel("What would you like from this?").fill("/save");
  await page.getByRole("button", { name: "Save & process" }).click();
  await expect(
    page.getByText(
      "Demo reference saved in this browser. AI analysis and research did not run.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Projects & goals" }).click();
  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Test project");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Example context only.");
  await page.getByRole("button", { name: "Save context", exact: true }).click();
  await expect(
    page.getByText("Test project", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "How to use" }).click();
  await expect(
    page.getByRole("heading", { name: "Start with a manual capture" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Today", exact: false })
    .first()
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `work/preview-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Remove demo data" }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your first useful capture" }),
  ).toBeVisible();
});
