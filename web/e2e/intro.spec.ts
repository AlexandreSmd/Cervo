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
  // Toucher à droite : écran suivant ; à gauche : retour
  await page.getByTestId("intro-stage").click({ position: { x: 300, y: 300 } });
  await expect(intro).toContainText("5 min");
  await page.getByTestId("intro-stage").click({ position: { x: 20, y: 300 } });
  await expect(intro).toContainText("Garde ton esprit");
  // Défilement automatique, à son rythme (7 s par écran)
  await expect(intro).toContainText("5 min", { timeout: 10_000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT, "0-intro-2-390.png") });
  await page.getByTestId("intro-next").click();
  await expect(intro).toContainText("Le même quiz pour tous");
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(OUT, "0-intro-3-390.png") });
  // On peut tout revoir depuis la fin
  await page.getByTestId("intro-replay").click();
  await expect(intro).toContainText("Garde ton esprit");
  await page.getByTestId("intro-next").click();
  await page.getByTestId("intro-next").click();
  await page.getByTestId("intro-start").click();
  await expect(page.getByTestId("start-quiz")).toBeVisible();
  // Et depuis l'accueil
  await page.getByTestId("show-intro").click();
  await expect(intro).toBeVisible();
  await page.getByTestId("intro-skip").click();
  await page.reload();
  await expect(page.getByTestId("start-quiz")).toBeVisible();
  await expect(page.getByTestId("intro")).toHaveCount(0);

  // On peut la revoir depuis le profil
  await page.goto("/profil");
  await page.getByTestId("replay-intro").click();
  await expect(page.getByTestId("intro")).toBeVisible();
});
