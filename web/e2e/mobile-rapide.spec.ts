import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium" });

test("sur mobile, à la réouverture l'accueil s'affiche tout de suite, même si l'API est lente", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("start-quiz")).toBeVisible();

  // Réseau mobile lent : l'API met 6 s à répondre.
  await page.route("**/api/today", async (route) => {
    await new Promise((r) => setTimeout(r, 6_000));
    await route.continue();
  });
  const reopened = Date.now();
  await page.reload();
  await expect(page.getByTestId("start-quiz")).toBeVisible({ timeout: 2_500 });
  expect(Date.now() - reopened).toBeLessThan(2_500);

  // Le jeu, lui, attend les données fraîches du serveur avant d'afficher la question.
  await page.getByTestId("start-quiz").click();
  await expect(page.getByRole("button", { name: "Valider" })).toBeVisible({ timeout: 15_000 });
});

test("une API qui ne répond pas affiche un message et un bouton Réessayer, pas un chargement sans fin", async ({ page }) => {
  await page.route("**/api/today", (route) => route.fulfill({ status: 503, body: "Service Unavailable" }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();
});
