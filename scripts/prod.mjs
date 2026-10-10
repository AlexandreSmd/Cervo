// Mise en production (voir docs/DEPLOIEMENT.md).
//   npm run prod:check   vérifie que tout est prêt (fichiers, comptes connectés)
//   npm run prod:deploy  API (Modal) → questions (Firestore) → site (Cloudflare)
//   npm run prod:api | prod:seed | prod:web   une seule étape
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { IS_WINDOWS, ROOT, c, log, run } from "./lib.mjs";

const ENV_FILE = join(ROOT, ".env.production");
const SERVICE_ACCOUNT = join(ROOT, "secrets", "firebase-admin.json");
const STATE_FILE = join(ROOT, ".prod-state.json");
const WRANGLER_DIR = join(ROOT, "infra", "cloudflare");
// Modal ne supporte pas encore Python 3.15 : on fixe la version utilisée par uvx.
const MODAL = ["--python", "3.12", "--from", "modal", "modal"];
const SECRET_NAME = "vif-prod";

function fail(message) {
  log(c("red", message));
  process.exit(1);
}

function readEnvFile(file) {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

/** Environnement de production : aucun émulateur, aucune valeur héritée de .env.local. */
function prodEnv(conf) {
  const env = { ...process.env };
  for (const key of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_PROJECT_ID"]) delete env[key];
  return {
    ...env,
    APP_ENV: "production",
    FIREBASE_PROJECT_ID: conf.VITE_FIREBASE_PROJECT_ID,
    FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(JSON.parse(readFileSync(SERVICE_ACCOUNT, "utf8"))),
    ADMIN_EMAILS: conf.ADMIN_EMAILS,
    TIMEZONE: conf.TIMEZONE || "Europe/Paris",
    FIRESTORE_DATABASE: conf.FIRESTORE_DATABASE || "(default)",
  };
}

function capture(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", shell: IS_WINDOWS, ...options });
  return { code: r.status ?? 1, out: `${r.stdout || ""}${r.stderr || ""}` };
}

function loadState() {
  return existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, "utf8")) : {};
}

// --- Étapes -------------------------------------------------------------------------

function check({ quiet = false } = {}) {
  const problems = [];
  if (!existsSync(ENV_FILE)) {
    fail("Il manque .env.production : copie .env.production.example en .env.production et remplis-le (docs/DEPLOIEMENT.md, étape 3).");
  }
  const conf = readEnvFile(ENV_FILE);
  for (const key of ["PROD_DOMAIN", "ADMIN_EMAILS", "VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID"]) {
    if (!conf[key]) problems.push(`${key} est vide dans .env.production`);
  }
  if (conf.VITE_FIREBASE_PROJECT_ID?.startsWith("demo-")) problems.push("VITE_FIREBASE_PROJECT_ID est encore le projet de démonstration");
  if (conf.VITE_USE_FIREBASE_EMULATOR !== "false" || conf.VITE_DEV_TOOLS !== "false") problems.push("VITE_USE_FIREBASE_EMULATOR et VITE_DEV_TOOLS doivent valoir false");

  if (!existsSync(SERVICE_ACCOUNT)) {
    problems.push("Il manque secrets/firebase-admin.json (clé du compte de service Firebase, étape 2)");
  } else {
    try {
      const sa = JSON.parse(readFileSync(SERVICE_ACCOUNT, "utf8"));
      if (sa.project_id !== conf.VITE_FIREBASE_PROJECT_ID) problems.push(`secrets/firebase-admin.json appartient au projet « ${sa.project_id} », pas à « ${conf.VITE_FIREBASE_PROJECT_ID} »`);
    } catch {
      problems.push("secrets/firebase-admin.json n'est pas un JSON valide");
    }
  }
  const modalToken = existsSync(join(homedir(), ".modal.toml")) || process.env.MODAL_TOKEN_ID;
  if (!modalToken) problems.push("Modal n'est pas connecté : lance « uvx --python 3.12 --from modal modal setup » (étape 4)");
  if (capture("npx", ["wrangler", "whoami"]).out.match(/not authenticated|You are not logged in/i)) problems.push("Cloudflare n'est pas connecté : lance « npx wrangler login » (étape 4)");

  if (problems.length) {
    log(c("red", "Pas encore prêt pour la production :"));
    for (const p of problems) console.log(`  - ${p}`);
    process.exit(1);
  }
  if (!quiet) log(c("green", "Tout est prêt pour la mise en ligne."));
  return conf;
}

function deployApi(conf) {
  log("API : secret de production sur Modal…");
  const env = prodEnv(conf);
  const vars = ["APP_ENV", "FIREBASE_PROJECT_ID", "FIREBASE_SERVICE_ACCOUNT_JSON", "ADMIN_EMAILS", "TIMEZONE", "FIRESTORE_DATABASE"].map((k) => `${k}=${env[k]}`);
  const secret = capture("uvx", [...MODAL, "secret", "create", SECRET_NAME, ...vars, "--force"]);
  if (secret.code !== 0) fail(`Création du secret Modal impossible :\n${secret.out}`);

  log("API : déploiement sur Modal (1 à 3 minutes la première fois)…");
  const deploy = capture("uvx", [...MODAL, "deploy", "modal_app.py"]);
  process.stdout.write(deploy.out);
  const url = deploy.out.match(/https:\/\/[\w.-]+\.modal\.run/)?.[0];
  if (deploy.code !== 0 || !url) fail("Le déploiement Modal a échoué (voir ci-dessus).");
  writeFileSync(STATE_FILE, JSON.stringify({ ...loadState(), apiOrigin: url }, null, 2));
  log(`API en ligne : ${c("green", url)}`);
  return url;
}

function seed(conf) {
  log("Questions : ajout des questions manquantes dans Firestore (production)…");
  const code = run("uv", ["run", "--quiet", "--project", "api", "python", "-m", "cervo.tools.seed"], { env: prodEnv(conf) });
  if (code !== 0) fail("Le chargement des questions a échoué.");
}

function deployWeb(conf) {
  const apiOrigin = loadState().apiOrigin;
  if (!apiOrigin) fail("Adresse de l'API inconnue : lance d'abord « npm run prod:api ».");
  log("Site : construction…");
  const buildEnv = { ...process.env, VITE_PUBLIC_URL: `https://${conf.PROD_DOMAIN}` };
  if (run("npm", ["run", "build", "--workspace", "web"], { env: buildEnv }) !== 0) fail("La construction du site a échoué.");

  const config = readFileSync(join(WRANGLER_DIR, "wrangler.template.toml"), "utf8").replaceAll("__DOMAIN__", conf.PROD_DOMAIN);
  const generated = join(WRANGLER_DIR, "wrangler.generated.toml");
  writeFileSync(generated, config);
  log("Site : déploiement sur Cloudflare…");
  if (run("npx", ["wrangler", "deploy", "--config", generated, "--var", `API_ORIGIN:${apiOrigin}`]) !== 0) fail("Le déploiement Cloudflare a échoué.");
  log(`Site en ligne : ${c("green", `https://${conf.PROD_DOMAIN}`)}`);
}

// --- Commandes ------------------------------------------------------------------------

const step = process.argv[2] ?? "deploy";
const conf = check({ quiet: step !== "check" });
if (step === "api") deployApi(conf);
if (step === "seed") seed(conf);
if (step === "web") deployWeb(conf);
if (step === "deploy") {
  deployApi(conf);
  seed(conf);
  deployWeb(conf);
  console.log(`
${c("bold", "  Vif est en ligne")}  →  ${c("green", `https://${conf.PROD_DOMAIN}`)}
  ${c("dim", `Espace fondateur : https://${conf.PROD_DOMAIN}/admin (connexion avec ${conf.ADMIN_EMAILS})`)}
`);
}
