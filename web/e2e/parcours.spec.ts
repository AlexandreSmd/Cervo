import { expect, test } from "@playwright/test";
import { playFullQuiz } from "./helpers";

const AUTH = "http://127.0.0.1:9099";
const PROJECT = "demo-cervo-daily";

test("parcours complet : quiz invité, résultats, profil, compte par lien magique, admin", async ({ page, request }) => {
  // 1. Quiz complet en session anonyme
  await playFullQuiz(page);
  await expect(page.getByTestId("day-score")).toBeVisible();
  await expect(page.getByTestId("pearl")).toHaveCount(10);

  // Partage sur ordinateur : le message est copié
  await page.getByTestId("share").click();
  await expect(page.getByTestId("share-copied")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/Mon score : \d+\/100/);
  expect(copied.match(/[🟢🔴]/gu)?.length).toBe(20);

  // Une seule participation par jour : l'accueil montre le score
  await page.goto("/");
  await expect(page.getByTestId("home-score")).toBeVisible();
  const dayScore = ((await page.getByTestId("home-score").textContent()) ?? "").replace("/100", "").trim();

  // 2. Profil
  await page.getByRole("link", { name: "Profil" }).click();
  await expect(page.getByText("jours joués")).toBeVisible();
  const username = await page.getByTestId("username").textContent();

  // 3. Création de compte par lien magique (lien lu dans l'émulateur Auth)
  const email = `joueur-${Date.now()}@cervo.test`;
  await page.getByTestId("create-account").click();
  await page.locator("#email").fill(email);
  await page.getByTestId("send-link").click();
  await expect(page.getByText(`Lien envoyé à ${email}`)).toBeVisible();
  const codes = await (await request.get(`${AUTH}/emulator/v1/projects/${PROJECT}/oobCodes`)).json();
  const link = codes.oobCodes.filter((c: { email: string }) => c.email === email).pop().oobLink as string;
  await page.goto(link);
  await expect(page).toHaveURL(/\/connexion|\/profil/);
  // L'émulateur redirige vers /connexion?…, qui rattache l'e-mail puis renvoie au profil
  await expect(page).toHaveURL(/\/profil$/, { timeout: 30_000 });
  await expect(page.getByText(`Connecté avec ${email}`)).toBeVisible();
  // L'historique invité est conservé (même uid, même pseudo)
  await expect(page.getByTestId("username")).toHaveText(username!);
  await expect(page.getByText("Historique")).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(`${dayScore}$`) }).first()).toBeVisible();

  // 4. Admin : connexion admin (outil de dev) puis ajout d'une question
  await page.getByRole("button", { name: "🛠 Dev" }).click();
  await page.getByRole("button", { name: "Connexion admin" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId("admin-question").first()).toBeVisible();
  await page.getByRole("tab", { name: "Ajouter" }).click();
  await page.locator("#q-type").selectOption("binary");
  await page.locator("#q-cat").selectOption("vrai_faux");
  await page.locator("#q-prompt").fill(`Le test de bout en bout ajoute une question (${Date.now()}).`);
  await page.locator("#q-bin").selectOption("true");
  await page.locator("#q-expl").fill("Question ajoutée automatiquement par le test Playwright.");
  await page.locator("#q-status").selectOption("draft");
  await page.getByTestId("admin-save").click();
  await expect(page.getByTestId("admin-created")).toBeVisible();
});
