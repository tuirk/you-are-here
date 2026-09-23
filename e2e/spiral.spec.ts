import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";

/**
 * The gap the unit tests cannot cover.
 *
 * Every Float32Array can be perfectly finite and the scene can still come up
 * empty — a broken shader, a lost WebGL context, an R3F upgrade that stops
 * mounting children. None of that throws, and none of it fails a unit test.
 * It just renders black.
 *
 * So these tests read actual pixels: the spiral must put a measurable number
 * of lit, *saturated* pixels on screen. Saturation is what separates the
 * emotional clusters from the white starfield behind them, so a passing run
 * means the particles specifically are drawing, not just the background.
 */

/**
 * Thresholds are measured, not guessed, and re-measured after the bloom pass
 * landed — bloom lifts both a healthy frame and a broken one, so the old
 * numbers no longer applied.
 *
 *   healthy        lit ~3.4%   saturated ~2.0%
 *   clusters gone  lit ~0.96%  saturated ~0.26%
 *
 * Saturation is the load-bearing measure: bloom spreads light across the
 * frame and narrows the lit-pixel gap, but it cannot invent colour where no
 * cluster is drawing, so the saturated margin stays wide (2.5x above, 3x
 * below) while lit is the coarser backstop.
 */
const MIN_LIT_RATIO = 0.015;
const MIN_SATURATED_RATIO = 0.008;

type FrameStats = {
  lit: number;
  saturated: number;
  total: number;
  litRatio: number;
  saturatedRatio: number;
};

const analyseFrame = (buffer: Buffer): FrameStats => {
  const png = PNG.sync.read(buffer);
  let lit = 0;
  let saturated = 0;

  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);

    if (max > 40) lit++;
    // a strong channel spread means a coloured particle, not a white star
    if (max > 60 && max - min > 40) saturated++;
  }

  const total = png.width * png.height;
  return {
    lit,
    saturated,
    total,
    litRatio: lit / total,
    saturatedRatio: saturated / total,
  };
};

/** One fresh navigation, then wait for the scene to settle and animate. */
const openSpiral = async (page: Page) => {
  await page.goto("/spiral", { waitUntil: "domcontentloaded" });
  await expect(page.locator("canvas")).toBeVisible();
  // R3F mounts, seed data loads, particles generate, camera settles
  await page.waitForTimeout(6000);
};

const collectPageErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
};

test.describe("spiral visualization", () => {
  test("mounts exactly one WebGL canvas", async ({ page }) => {
    await openSpiral(page);
    await expect(page.locator("canvas")).toHaveCount(1);
  });

  test("renders a scene instead of a blank frame", async ({ page }) => {
    await openSpiral(page);
    const stats = analyseFrame(await page.screenshot());

    console.log(
      `lit ${(stats.litRatio * 100).toFixed(2)}%  saturated ${(stats.saturatedRatio * 100).toFixed(2)}%`
    );

    expect(stats.litRatio, "screen is black — the scene did not render").toBeGreaterThan(MIN_LIT_RATIO);
  });

  test("draws coloured particle clusters, not just the starfield", async ({ page }) => {
    await openSpiral(page);
    const stats = analyseFrame(await page.screenshot());

    expect(
      stats.saturatedRatio,
      "too few saturated pixels — stars are drawing but the emotional clusters are missing"
    ).toBeGreaterThan(MIN_SATURATED_RATIO);
  });

  test("renders the spiral without console errors", async ({ page }) => {
    const errors = collectPageErrors(page);
    await openSpiral(page);
    expect(errors).toEqual([]);
  });

  test("keeps rendering after the camera is orbited", async ({ page }) => {
    await openSpiral(page);

    const box = await page.locator("canvas").boundingBox();
    if (!box) throw new Error("canvas has no bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 60, { steps: 20 });
    await page.mouse.up();

    // Releasing over the spiral also counts as placing a tilde, which opens
    // the entry composer over the canvas. Dismiss it via its own control
    // before measuring, so the reading is of the scene and not the dialog.
    const cancel = page.getByRole("button", { name: /^cancel$/i });
    if (await cancel.isVisible().catch(() => false)) {
      await cancel.click();
    }
    await expect(page.getByPlaceholder(/what's on your mind/i)).toBeHidden();
    await page.waitForTimeout(2500);

    const stats = analyseFrame(await page.screenshot());
    expect(stats.litRatio, "scene went blank after orbiting").toBeGreaterThan(MIN_LIT_RATIO);
  });

  test("clicking the spiral opens the entry composer", async ({ page }) => {
    // Exercises TildePlacement's pointer handlers end to end.
    await openSpiral(page);

    const box = await page.locator("canvas").boundingBox();
    if (!box) throw new Error("canvas has no bounding box");

    // The click target is an invisible tube following the spiral path, not
    // the whole canvas — the centre is the hollow core and deliberately
    // misses. Probe outward around the centre until a click lands on the
    // path, so the test survives camera framing changes.
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const composer = page.getByPlaceholder(/what's on your mind/i);

    let opened = false;
    for (const radius of [120, 170, 220]) {
      for (let i = 0; i < 12 && !opened; i++) {
        const angle = (i / 12) * Math.PI * 2;
        await page.mouse.click(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius * 0.6);
        if (await composer.isVisible().catch(() => false)) opened = true;
      }
      if (opened) break;
    }

    await expect(composer, "no click anywhere on the spiral path opened the composer").toBeVisible();
  });
});

test.describe("entry point", () => {
  test("landing page renders its starfield and call to action", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("You're Here")).toBeVisible();
    await expect(page.getByRole("button", { name: /enter/i })).toBeVisible();
  });

  test("entering the app routes through to the spiral", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /enter/i }).click();
    await expect(page).toHaveURL(/\/spiral$/);
  });

  test("the help legend lists the sentiment categories", async ({ page }) => {
    await openSpiral(page);
    await page.locator("button").last().click();
    await expect(page.getByText(/joy/i).first()).toBeVisible();
  });
});
