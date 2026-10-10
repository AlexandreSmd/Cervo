import { expect, type Page } from "@playwright/test";

/** Répond à la question affichée selon son format, puis valide. */
export async function answerCurrent(page: Page) {
  const radios = page.getByRole("radiogroup", { name: "Choix" }).getByRole("radio");
  if (await radios.count()) {
    await radios.first().click();
  } else {
    await page.locator("#answer").fill((await page.locator("#answer").getAttribute("inputmode")) === "decimal" ? "100" : "42");
  }
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByTestId("feedback")).toBeVisible();
}

export async function playFullQuiz(page: Page) {
  await page.goto("/");
  await page.getByTestId("start-quiz").click();
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByTestId("progress")).toHaveText(`${i}/10`);
    await answerCurrent(page);
    await page.getByTestId("next").click();
  }
  await expect(page).toHaveURL(/\/resultats\/\d{4}-\d{2}-\d{2}$/);
}

export async function adminLogin(page: Page) {
  await page.goto("/admin");
  await page.getByTestId("admin-dev-login").click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
}
