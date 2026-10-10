import { expect, type Page } from "@playwright/test";

/** Répond à la question affichée selon son format, puis valide. */
export async function answerCurrent(page: Page) {
  const memorize = page.getByTestId("memorize");
  if (await memorize.isVisible().catch(() => false)) await memorize.waitFor({ state: "detached", timeout: 20_000 });
  const validate = page.getByRole("button", { name: "Valider" });
  await expect(validate).toBeEnabled();

  const radios = page.getByRole("radiogroup", { name: "Choix" }).getByRole("radio");
  const orderItems = page.getByTestId("order-item");
  const slider = page.getByRole("slider", { name: "Curseur" });
  if (await radios.count()) {
    await radios.first().click();
  } else if (await orderItems.count()) {
    for (const item of await orderItems.all()) await item.click();
  } else if (await slider.count()) {
    await slider.click();
  } else if (await page.getByTestId("size-value").count()) {
    // le curseur de taille a une valeur par défaut
  } else {
    const input = page.locator("#answer");
    await input.fill((await input.getAttribute("inputmode")) === "decimal" ? "100" : "Il faut cultiver notre jardin");
  }
  await validate.click();
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
