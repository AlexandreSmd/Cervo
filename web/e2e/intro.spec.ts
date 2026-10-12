import { devices, expect, test } from "@playwright/test";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "screenshots");

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium", storageState: { cookies: [], origins: [] } });

test("première visite : l'intro présente la mission, puis ne revient plus", async ({ page }) => {
  await page.goto("/");
  const intro = page.getByTestId("intro");
  await expect(intro).toContainText("Garde ton esprit");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, "0-intro-1-390.png") });
  // Défilement automatique vers l'écran « 5 min »
  await expect(intro).toContainText("5 min", { timeout: 6000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT, "0-intro-2-390.png") });
  await page.getByTestId("intro-next").click();
  await expect(intro).toContainText("Le même quiz pour tous");
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(OUT, "0-intro-3-390.png") });
  await page.getByTestId("intro-start").click();
  await expect(page.getByTestId("start-quiz")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("start-quiz")).toBeVisible();
  await expect(page.getByTestId("intro")).toHaveCount(0);
});
