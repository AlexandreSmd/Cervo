import { expect, test } from "@playwright/test";
import { adminLogin, playFullQuiz } from "./helpers";

const AUTH = "http://127.0.0.1:9099";
const PROJECT = "demo-cervo-daily";

test("parcours joueur : quiz invité, résultats, partage, profil, compte par lien magique", async ({ page, request }) => {
  await playFullQuiz(page);
  await expect(page.getByTestId("day-score")).toBeVisible();
  await expect(page.getByTestId("pearl")).toHaveCount(10);

  // Partage sur ordinateur : le message est copié
  await page.getByTestId("share").click();
  await expect(page.getByTestId("share-copied")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/Mon score : \d+\/100/);
  expect(copied.match(/[🟢🔴]/gu)?.length).toBe(20);

  // Une seule participation par jour
  await page.goto("/");
  await expect(page.getByTestId("home-score")).toBeVisible();

  // Profil
  await page.getByRole("link", { name: "Profil" }).click();
  await expect(page.getByText("Mes questions")).toBeVisible();
  const username = await page.getByTestId("username").textContent();

  // Compte par lien magique (lien lu dans l'émulateur Auth) : même joueur, historique gardé
  const email = `joueur-${Date.now()}@cervo.test`;
  await page.getByTestId("create-account").click();
  await page.locator("#email").fill(email);
  await page.getByTestId("send-link").click();
  await expect(page.getByText(`Lien envoyé à ${email}`)).toBeVisible();
  const codes = await (await request.get(`${AUTH}/emulator/v1/projects/${PROJECT}/oobCodes`)).json();
  const link = codes.oobCodes.filter((c: { email: string }) => c.email === email).pop().oobLink as string;
  await page.goto(link);
  await expect(page).toHaveURL(/\/profil$/, { timeout: 30_000 });
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByTestId("username")).toHaveText(username!);
  await expect(page.locator("li").filter({ hasText: "toi :" }).first()).toBeVisible();
});

test("espace fondateur : tableau de bord, planning par glisser-déposer, nouvelle question", async ({ page }) => {
  await adminLogin(page);
  await expect(page.getByText("Joueurs aujourd'hui")).toBeVisible();

  // Planning : on remplit 4 semaines, puis on glisse une question de la banque sur un jour futur
  await page.getByRole("link", { name: "Planning" }).click();
  await page.getByTestId("fill").click();
  await expect(page.getByRole("status")).toHaveText("Jours vides planifiés");
  const future = new Date(Date.now() + 5 * 86400_000).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
  const slot = page.getByTestId(`slot-${future}-0`);
  await expect(slot).toBeVisible();
  const bankItem = page.getByTestId("bank").locator("button").first();
  const prompt = (await bankItem.textContent())!.trim();
  await bankItem.dragTo(slot);
  await expect(page.getByRole("status")).toHaveText("Planning mis à jour");
  await page.reload();
  await expect(page.getByTestId(`slot-${future}-0`)).toContainText(prompt.slice(0, 20));

  // Réordonner : le badge 1 glissé en position 3
  const first = (await page.getByTestId(`slot-${future}-0`).textContent())!;
  await page.getByTestId(`slot-${future}-0`).dragTo(page.getByTestId(`slot-${future}-2`));
  await expect(page.getByTestId(`slot-${future}-2`)).toContainText(first.slice(1, 20));

  // Questions déjà posées : celles du jour (des joueurs ont joué dans le premier test)
  await page.getByRole("link", { name: "Déjà posées" }).click();
  await expect(page.getByRole("heading", { name: "Déjà posées" })).toBeVisible();
  await expect(page.getByTestId("admin-question").first()).toBeVisible();

  // Nouvelle question à partir d'un modèle
  await page.getByRole("link", { name: "Pas encore posées" }).click();
  await page.getByTestId("new-question").click();
  await page.getByTestId("template-vf").click();
  await page.locator("#q-prompt").fill(`Le test de bout en bout ajoute une question (${Date.now()}).`);
  await page.getByRole("radiogroup", { name: "Bonne réponse" }).getByRole("radio", { name: "Vrai" }).click();
  await page.locator("#q-expl").fill("Question ajoutée automatiquement par le test Playwright.");
  await page.getByRole("radiogroup", { name: "Statut" }).getByRole("radio", { name: "Brouillon" }).click();
  await page.getByTestId("admin-save").click();
  await expect(page.getByTestId("admin-created")).toBeVisible();

  // Modèle « Remettre dans l'ordre »
  await page.getByTestId("new-question").click();
  await page.getByTestId("template-ordre").click();
  for (const [i, v] of ["Antiquité", "Moyen Âge", "Renaissance", "Époque moderne"].entries()) await page.getByLabel(`Élément ${i + 1}`).fill(v);
  await page.locator("#q-expl").fill("Les grandes périodes de l'histoire, dans l'ordre.");
  await page.getByTestId("admin-save").click();
  await expect(page.getByTestId("admin-created")).toBeVisible();
});
