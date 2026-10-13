import { expect, test } from "@playwright/test";
import { answerCurrent } from "./helpers";

test("gestes du quiz : clavier, correction sur les choix, quitter, hors ligne, « j'ai retenu »", async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.getByTestId("duration")).toHaveText("≈ 5 min");
  await page.getByTestId("start-quiz").click();

  // Question 1 (QCM) : la touche « 1 » répond, la correction s'affiche sur les choix.
  await expect(page.getByRole("radiogroup", { name: "Choix" }).getByRole("radio").first()).toBeEnabled();
  await page.keyboard.press("1");
  await expect(page.getByTestId("choice-reveal")).toBeVisible();
  await page.getByTestId("next").click();

  // Question 2 (chronométrée) : quitter demande confirmation, « Je reste » garde la question.
  await expect(page.getByTestId("timer")).toBeVisible();
  await page.getByTestId("quit").click();
  await expect(page.getByTestId("quit-confirm")).toBeVisible();
  await page.getByRole("button", { name: "Je reste" }).click();
  await expect(page.getByTestId("quit-confirm")).toBeHidden();
  await expect(page).toHaveURL(/\/jouer$/);

  // Réseau coupé : un bandeau le dit, puis disparaît.
  await context.setOffline(true);
  await expect(page.getByTestId("offline")).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByTestId("offline")).toBeHidden();

  await answerCurrent(page);
  await page.getByTestId("next").click();
  await answerCurrent(page);
  await page.getByTestId("next").click();

  // Question 4 (mémoire) : on peut passer la mémorisation dès qu'on a retenu.
  await expect(page.getByTestId("memorize")).toBeVisible();
  await page.getByTestId("memorized").click();
  await expect(page.getByTestId("memorize")).toBeHidden();
  await expect(page.getByTestId("gesture")).toBeVisible();
});
