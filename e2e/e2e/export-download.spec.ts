import { test, expect } from "@playwright/test";
import { stat } from "node:fs/promises";

test("export tab downloads PDF and ZIP for a manually-created kit", async ({ page }) => {
    // 1. Visit /new
    await page.goto("/new");

    // 2. Switch to Manual tab and wait for its panel to mount
    const manualTab = page.getByRole("tab", { name: "Manual" });
    await manualTab.waitFor({ state: "visible" });
    await manualTab.click();
    await page.locator("#brand").waitFor({ state: "visible" });

    // 3. Fill the form
    await page.locator("#brand").fill("E2E Test Kit");
    await page.locator("#hex").fill("#1d3557, #e63946, #f1faee");
    await page.locator("#fonts").fill("Inter, Playfair Display");

    // 4. Submit
    await page.getByRole("button", { name: /build kit from inputs/i }).click();

    // 5. Wait for the kit page (manual still runs AI extraction → up to ~60s)
    await page.waitForURL(/\/kit\/[^/]+/, { timeout: 90_000 });

    // 6. Open Export tab
    await page.getByRole("tab", { name: /^export$/i }).click();

    // 7. PDF download
    const [pdfDownload] = await Promise.all([
        page.waitForEvent("download", { timeout: 60_000 }),
        page.getByRole("button", { name: /brand guide \(\.pdf\)/i }).click(),
    ]);
    expect(pdfDownload.suggestedFilename()).toMatch(/-brand-guide\.pdf$/);
    const pdfPath = await pdfDownload.path();
    expect(pdfPath).toBeTruthy();
    const pdfStats = await stat(pdfPath!);
    expect(pdfStats.size).toBeGreaterThan(1000);

    // 8. ZIP download
    const [zipDownload] = await Promise.all([
        page.waitForEvent("download", { timeout: 60_000 }),
        page.getByRole("button", { name: /download full kit \(\.zip\)/i }).click(),
    ]);
    expect(zipDownload.suggestedFilename()).toMatch(/-brand-kit\.zip$/);
    const zipPath = await zipDownload.path();
    expect(zipPath).toBeTruthy();
    const zipStats = await stat(zipPath!);
    expect(zipStats.size).toBeGreaterThan(1000);
});
