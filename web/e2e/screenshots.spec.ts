import { expect, test } from "@playwright/test";
import { answerCurrent } from "./helpers";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "screenshots");
mkdirSync(OUT, { recursive: true });

for (const width of [390, 1280]) {
  test(`captures d'écran ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const shot = (name: string) => page.screenshot({ path: join(OUT, `${name}-${width}.png`), fullPage: true });

    await page.goto("/");
    await expect(page.getByTestId("start-quiz")).toBeVisible();
    await page.waitForTimeout(300);
    await shot("1-accueil");

    await page.getByTestId("start-quiz").click();
    await page.getByTestId("intro-go").click();
    await expect(page.getByTestId("question-prompt")).toBeVisible();
    await shot("2-question");

    await answerCurrent(page);
    await page.waitForTimeout(900);
    await shot("3-feedback");
    await page.getByTestId("next").click();
    for (let i = 2; i <= 10; i++) {
      await answerCurrent(page);
      await page.getByTestId("next").click();
    }
    await expect(page.getByTestId("day-score")).toBeVisible();
    await page.waitForTimeout(900);
    await shot("4-resultats");

    // Profil rempli grâce à l'historique fictif (outil de dev)
    await page.getByRole("button", { name: "🛠 Dev" }).click();
    await page.getByRole("button", { name: "Ajouter 3 semaines d'historique" }).click();
    await expect(page).toHaveURL(/\/profil$/);
    await page.getByRole("button", { name: "🛠 Dev" }).click();
    await expect(page.getByText("La forme de ton cerveau")).toBeVisible();
    await page.waitForTimeout(500);
    await shot("5-profil");
  });
}
