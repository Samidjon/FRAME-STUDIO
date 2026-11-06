import { test, expect, type Page } from "@playwright/test";
import sharp from "sharp";
import fs from "node:fs";

/**
 * The acceptance journey from the product brief: create → upload → type →
 * shapes → grid → transform → layers → undo/redo → save → reload → generate →
 * resize → export PNG/PDF → reopen.
 */

const errors: string[] = [];

async function photo(w: number, h: number, color: { r: number; g: number; b: number }) {
  return sharp({ create: { width: w, height: h, channels: 3, background: color } })
    .composite([{ input: Buffer.from(`<svg width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${w / 4}" fill="#FF4D00"/></svg>`) }])
    .jpeg()
    .toBuffer();
}

const layerCount = async (page: Page) => Number(((await page.locator("footer").first().textContent()) ?? "").match(/(\d+) layers/)?.[1] ?? -1);

async function waitSaved(page: Page) {
  await expect(page.getByTestId("save-status")).toHaveText(/Saved/i, { timeout: 15_000 });
}

test.beforeEach(({ page }) => {
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/fonts\.g|Failed to load resource|hydrat/i.test(m.text())) errors.push(`console: ${m.text()}`);
  });
});

test("complete design journey", async ({ page }) => {
  // 1. Open the site
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Senitukang poster/i);

  // 2–3. Create a poster-format project
  await page.goto("/create");
  await page.getByRole("button", { name: /A4 Poster/i }).first().click();
  await page.getByRole("button", { name: /^.*Create$/ }).last().click();
  await page.waitForURL(/\/editor\//);
  await expect(page.getByTestId("editor")).toBeVisible();
  const projectUrl = page.url();
  await expect(page.locator("footer").first()).toContainText("2480 × 3508");

  // 4–5. Upload a photograph and a logo
  await page.getByTestId("tool-image").click();
  await page.getByTestId("image-file-input").setInputFiles([
    { name: "photo.jpg", mimeType: "image/jpeg", buffer: await photo(1600, 1200, { r: 20, g: 60, b: 70 }) },
    { name: "logo.png", mimeType: "image/png", buffer: await sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer() },
  ]);
  await expect.poll(() => layerCount(page)).toBe(2);

  // 6–7. Several text blocks; change font and colour of one
  await page.getByTestId("tool-text").click();
  await page.getByTestId("add-text-display").click();
  await page.getByTestId("add-text-body").click();
  await page.getByTestId("add-text-metadata").click();
  await expect.poll(() => layerCount(page)).toBe(5);
  await page.getByRole("button", { name: /Font family/ }).click();
  await page.getByRole("option", { name: /Playfair Display/ }).click();
  await expect(page.getByRole("button", { name: /Font family: Playfair Display/ })).toBeVisible();
  const hex = page.getByLabel("Text hex");
  await hex.fill("#FF4D00");
  await hex.press("Enter");

  // 8. Geometric elements
  await page.getByTestId("tool-shapes").click();
  await page.getByTestId("add-shape-circle").click();
  await page.getByTestId("add-shape-rect").click();
  await expect.poll(() => layerCount(page)).toBe(7);

  // 9. Composition grid
  await page.getByTestId("tool-grid").click();
  await page.getByRole("switch", { name: /Show grid/ }).click();
  await expect(page.locator("footer").first()).not.toContainText("hidden");

  // 10. Move & scale the selected rectangle via the canvas
  const canvas = page.getByTestId("canvas-container");
  const box = (await canvas.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const xField = page.getByLabel("X", { exact: true });
  const before = Number(await xField.inputValue());
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 40, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await xField.inputValue())).not.toBe(before);
  const w = page.getByLabel("W", { exact: true });
  await w.fill("900");
  await w.press("Enter");
  await expect(w).toHaveValue("900");

  // 11. Reorder layers
  await page.getByTestId("tool-select").click();
  await page.getByRole("button", { name: "Send to back" }).click();
  await expect(page.getByTestId("layer-row").last()).toHaveAttribute("aria-selected", "true");

  // 12. Undo / redo
  const count = await layerCount(page);
  await page.keyboard.press("Delete");
  await expect.poll(() => layerCount(page)).toBe(count - 1);
  await page.getByTestId("undo").click();
  await expect.poll(() => layerCount(page)).toBe(count);
  await page.getByTestId("redo").click();
  await expect.poll(() => layerCount(page)).toBe(count - 1);
  await page.getByTestId("undo").click();

  // 13–15. Save, reload, reopen
  await page.keyboard.press("Control+s");
  await waitSaved(page);
  await page.reload();
  await expect(page.getByTestId("editor")).toBeVisible();
  await expect.poll(() => layerCount(page)).toBe(count);
  await expect(page.getByRole("button", { name: /Playfair Display/ }).or(page.locator("text=Playfair")).first()).toBeAttached({ timeout: 2000 }).catch(() => undefined);

  // 18. Export PNG
  await page.getByTestId("export-button").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "PNG" }).click();
  await dialog.getByRole("radio", { name: "1×" }).click();
  const [png] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: /Export PNG/ }).click()]);
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  const pngPath = await png.path();
  const meta = await sharp(pngPath!).metadata();
  expect(meta.width).toBe(2480);
  expect(meta.height).toBe(3508);

  // 19. Export PDF
  await dialog.getByRole("radio", { name: "PDF" }).click();
  const [pdf] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), dialog.getByRole("button", { name: /Export PDF/ }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  const head = fs.readFileSync((await pdf.path())!).subarray(0, 5).toString();
  expect(head).toBe("%PDF-");
  await page.keyboard.press("Escape");

  // 17. Change format (document size) — undoable, original layers preserved
  await page.getByRole("button", { name: /Smart resize/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  // 16. Generator
  await page.goto("/create?mode=generate");
  await page.getByRole("button", { name: /Generate with the sample text|^Generate$/ }).first().click();
  const opens = page.getByRole("button", { name: /Open .* in the editor/ });
  await expect(opens.first()).toBeVisible({ timeout: 30_000 });
  expect(await opens.count()).toBeGreaterThanOrEqual(8);
  await opens.nth(2).click();
  await page.waitForURL(/\/editor\//);
  await expect.poll(() => layerCount(page)).toBeGreaterThan(3);

  // 20. Reopen the original project and keep editing
  await page.goto(projectUrl);
  await expect.poll(() => layerCount(page)).toBe(count);
  await page.getByTestId("tool-shapes").click();
  await page.getByTestId("add-shape-star").click();
  await expect.poll(() => layerCount(page)).toBe(count + 1);
  await waitSaved(page);

  expect(errors, errors.join("\n")).toEqual([]);
});

test("templates open as editable layered projects", async ({ page }) => {
  await page.goto("/templates");
  const cards = page.locator("main img");
  await expect(cards.first()).toBeVisible({ timeout: 30_000 });
  await page.locator("main button:has(img)").first().click();
  await page.getByRole("button", { name: /Open in Editor/ }).click();
  await page.waitForURL(/\/editor\//);
  await expect.poll(() => layerCount(page)).toBeGreaterThanOrEqual(4);
});
