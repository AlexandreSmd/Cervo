// npm run test:e2e : parcours de bout en bout avec Playwright (Chromium).
// Playwright lance lui-même « npm run dev » si le site ne tourne pas déjà.
import { join } from "node:path";
import { ROOT, loadEnv, log, run } from "./lib.mjs";

const env = loadEnv();
if (!env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD && !env.PLAYWRIGHT_CHROMIUM_PATH) {
  log("Vérification de Chromium pour Playwright (téléchargé une fois dans le cache de Playwright de ton compte)…");
  run("npx", ["playwright", "install", "chromium"], { cwd: join(ROOT, "web"), env });
}
process.exit(run("npx", ["playwright", "test", ...process.argv.slice(2)], { cwd: join(ROOT, "web"), env }));
