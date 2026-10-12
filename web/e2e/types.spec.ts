import { devices, expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { answerCurrent } from "./helpers";

// Un quiz complet sur téléphone : une capture de chaque type de question, avant et après la réponse.
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "screenshots", "types");
mkdirSync(OUT, { recursive: true });

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium" });

test("les 10 types, un par question, dans l'ordre", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await expect(page.getByTestId("lineup").locator("li")).toHaveCount(10);
  await page.getByTestId("start-quiz").click();
  const kinds: string[] = [];
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByTestId("progress")).toHaveText(`${i}/10`);
    const memorize = page.getByTestId("memorize");
    if (await memorize.isVisible().catch(() => false))
      await page.screenshot({ path: join(OUT, `${String(i).padStart(2, "0")}-0-memorisation.png`) });
    await expect(page.getByTestId("kind-chip")).toBeVisible({ timeout: 20_000 });
    kinds.push((await page.getByTestId("kind-chip").textContent())!.trim());
    await page.screenshot({ path: join(OUT, `${String(i).padStart(2, "0")}-1-question.png`), fullPage: true });
    await answerCurrent(page);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, `${String(i).padStart(2, "0")}-2-reponse.png`), fullPage: true });
    await page.getByTestId("next").click();
  }
  const expected = [
    "Vocabulaire",
    "Taille",
    "Fait étonnant",
    "Mémoire",
    "Statistique",
    "Chronologie",
    "Estimation",
    "Devinette",
    "Énigme",
    "Dictée",
  ];
  expected.forEach((label, i) => expect(kinds[i]).toContain(label));
  await expect(page.getByTestId("day-score")).toBeVisible();
});
