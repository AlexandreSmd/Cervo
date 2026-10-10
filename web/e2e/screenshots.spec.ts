import { expect, test, type Page } from "@playwright/test";
import { adminLogin, answerCurrent } from "./helpers";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "screenshots");
mkdirSync(OUT, { recursive: true });

async function shot(page: Page, name: string, width: number) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `${name}-${width}.png`), fullPage: true });
}

for (const width of [390, 1280]) {
  test(`captures joueur ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto("/");
    await expect(page.getByTestId("start-quiz")).toBeVisible();
    await shot(page, "1-accueil", width);
    await page.getByTestId("start-quiz").click();
    await expect(page.getByTestId("question-prompt")).toBeVisible();
    await shot(page, "2-question", width);
    await answerCurrent(page);
    await shot(page, "3-feedback", width);
    await page.getByTestId("next").click();
    for (let i = 2; i <= 10; i++) {
      await answerCurrent(page);
      await page.getByTestId("next").click();
    }
    await expect(page.getByTestId("day-score")).toBeVisible();
    await shot(page, "4-resultats", width);
    await page.getByRole("link", { name: "Profil" }).first().click();
    await expect(page.getByText("Mes questions")).toBeVisible();
    await shot(page, "5-profil", width);
  });
}

test("captures espace fondateur", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await adminLogin(page);
  await page.getByTestId("dev-simulate").click();
  await expect(page.getByText("Joueurs simulés ✓")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Joueurs aujourd'hui")).toBeVisible();
  await shot(page, "6-admin-tableau-de-bord", 1440);
  await page.getByRole("link", { name: "Planning" }).click();
  await page.getByTestId("fill").click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.screenshot({ path: join(OUT, "7-admin-planning-1440.png") });
  await page.getByRole("link", { name: "Pas encore posées" }).click();
  await shot(page, "8-admin-banque", 1440);
  await page.getByTestId("new-question").click();
  await page.getByTestId("template-taille").click();
  await page.getByLabel("Emoji de référence").fill("☕");
  await page.getByLabel("Objet de référence").fill("Tasse");
  await page.getByLabel("Emoji à ajuster").fill("🍽️");
  await page.getByLabel("Objet à ajuster").fill("Assiette");
  await page.screenshot({ path: join(OUT, "9-admin-editeur-taille-1440.png") });
});
