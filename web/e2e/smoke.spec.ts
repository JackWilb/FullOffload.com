import { expect, test } from "@playwright/test";

test("a phone visitor looks up a device and reaches the submit flow", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "See which models hit full offload on your hardware.",
    }),
  ).toBeVisible();

  // Searching a family lists all its memory variants.
  const search = page.getByRole("combobox", { name: "Search your GPU or Mac" });
  await search.fill("m3 max");
  const options = page.getByRole("option");
  await expect(options.first()).toBeVisible();
  expect(await options.count()).toBeGreaterThan(1);
  for (const option of await options.allTextContents())
    expect(option).toContain("M3 Max");

  // Picking a device opens its results page at a readable hash URL.
  await search.fill("4090");
  await page
    .getByRole("option", { name: /^RTX 4090\b/ })
    .first()
    .click();
  await expect(page).toHaveURL(/#\/device\/rtx-4090$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "RTX 4090" }),
  ).toBeVisible();
  await expect(page.getByText("24 GB VRAM")).toBeVisible();

  // Submitting requires signing in.
  await page.getByRole("link", { name: "Submit a result" }).first().click();
  await expect(page).toHaveURL(/#\/submit/);
  await expect(
    page.getByRole("heading", { name: "Sign in to submit results" }),
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
});
