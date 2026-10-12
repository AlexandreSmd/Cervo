import { expect, test } from "@playwright/test";

test("chrono : sans réponse, la question est perdue à la fin du temps", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.getByTestId("start-quiz").click();
  const memorize = page.getByTestId("memorize");
  if (await memorize.isVisible().catch(() => false)) await memorize.waitFor({ state: "detached", timeout: 20_000 });
  await expect(page.getByTestId("timer")).toBeVisible();
  // On ne répond pas : le verdict « Temps écoulé » apparaît tout seul
  await expect(page.getByTestId("verdict")).toHaveText("Temps écoulé", { timeout: 60_000 });
  await expect(page.getByTestId("score-value")).toHaveText("+0");

  // Recharger ne relance pas le chrono de la question suivante
  await page.getByTestId("next").click();
  await expect(page.getByTestId("timer")).toBeVisible({ timeout: 20_000 });
  const secondsLeft = async () => Number((await page.getByTestId("timer").getAttribute("aria-label"))?.split(" ")[0]);
  const before = await secondsLeft();
  await page.waitForTimeout(3000);
  await page.reload();
  await expect(page.getByTestId("timer")).toBeVisible({ timeout: 20_000 });
  expect(await secondsLeft()).toBeLessThanOrEqual(before - 2);
});
