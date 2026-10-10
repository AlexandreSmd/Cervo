import { devices, expect, test } from "@playwright/test";
import { playFullQuiz } from "./helpers";

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium" });

test("sur mobile, le bouton ouvre la feuille de partage (Messenger) avec les 10 résultats en couleur", async ({ page }) => {
  // Simule la feuille de partage du téléphone et garde le message envoyé.
  await page.addInitScript(() => {
    (window as unknown as { __shared: unknown[] }).__shared = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: unknown) => { (window as unknown as { __shared: unknown[] }).__shared.push(data); },
    });
  });
  await playFullQuiz(page);
  const button = page.getByTestId("share");
  await expect(button).toHaveText(/Envoyer sur Messenger/);
  await button.click();
  await expect(page.getByText("Envoyé !")).toBeVisible();

  const shared = await page.evaluate(() => (window as unknown as { __shared: { text: string }[] }).__shared);
  expect(shared).toHaveLength(1);
  const text = shared[0].text;
  expect(text).toMatch(/Mon score : \d+\/100/);
  for (let i = 1; i <= 10; i++) expect(text).toMatch(new RegExp(`${i}\\. [🟢🔴] \\d+/100`, "u"));
  expect(text).toContain("questions réussies");
});
