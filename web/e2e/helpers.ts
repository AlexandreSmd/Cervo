import { expect, type Page } from "@playwright/test";

/** Répond à la question affichée selon son type, puis valide. */
export async function answerCurrent(page: Page) {
  const radios = page.getByRole("radio");
  if (await radios.count()) {
    await radios.first().click();
  } else {
    const input = page.locator("#answer");
    const label = (await page.locator('label[for="answer"]').textContent()) ?? "";
    await input.fill(label.includes("estimation") ? "100" : "42");
  }
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByTestId("feedback")).toBeVisible();
}

export async function playFullQuiz(page: Page) {
  await page.goto("/");
  await page.getByTestId("start-quiz").click();
  await page.getByTestId("intro-go").click();
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByTestId("progress")).toHaveText(`Question ${i}/10`);
    await answerCurrent(page);
    await page.getByTestId("next").click();
  }
  await expect(page).toHaveURL(/\/resultats\/\d{4}-\d{2}-\d{2}$/);
}
