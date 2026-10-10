// npm run dev : émulateurs Firebase + API FastAPI (8000) + front Vite (5173),
// puis chargement des questions si Firestore est vide.
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { EMULATOR_DATA, FIREBASE_BIN, ROOT, apiTool, c, emulatorHosts, isUp, loadEnv, log, start, waitFor } from "./lib.mjs";

const env = loadEnv();
const project = env.FIREBASE_PROJECT_ID || "demo-cervo-daily";
const children = [];
let stopping = false;

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  log("Arrêt en cours (sauvegarde des données des émulateurs)…");
  for (const child of children) if (child.exitCode === null) child.kill("SIGINT");
  const deadline = Date.now() + 20000;
  const timer = setInterval(() => {
    if (children.every((ch) => ch.exitCode !== null || ch.signalCode !== null) || Date.now() > deadline) {
      clearInterval(timer);
      for (const child of children) if (child.exitCode === null) child.kill("SIGKILL");
      process.exit(code);
    }
  }, 200);
}
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

function watch(name, child) {
  children.push(child);
  child.on("exit", (code) => {
    if (!stopping) {
      log(c("red", `${name} s'est arrêté (code ${code}). Arrêt des autres services.`));
      stopAll(1);
    }
  });
}

for (const [label, url] of [["API (port 8000)", "http://127.0.0.1:8000/api/health"], ["Front (port 5173)", "http://127.0.0.1:5173"]]) {
  if (await isUp(url)) {
    log(c("red", `${label} est déjà utilisé : une autre instance tourne-t-elle ? Arrête-la puis relance.`));
    process.exit(1);
  }
}

if (!existsSync(FIREBASE_BIN)) {
  log(c("red", "firebase-tools est absent : lance d'abord « npm run setup »."));
  process.exit(1);
}

const hosts = emulatorHosts(env);
const emulatorArgs = [FIREBASE_BIN, "emulators:start", "--only", "auth,firestore", "--project", project, "--export-on-exit", EMULATOR_DATA];
if (existsSync(join(EMULATOR_DATA, "firebase-export-metadata.json"))) emulatorArgs.push("--import", EMULATOR_DATA);
log("Démarrage des émulateurs Firebase (le premier lancement télécharge l'émulateur Firestore)…");
watch("Émulateurs", start("firebase", "yellow", process.execPath, emulatorArgs, { env, shell: false }));

try {
  await waitFor(hosts.firestore, 180000, "L'émulateur Firestore");
  await waitFor(hosts.auth, 60000, "L'émulateur Auth");
} catch (err) {
  log(c("red", err.message));
  stopAll(1);
}
if (stopping) await new Promise(() => {});

log("Chargement des nouvelles questions…");
if (apiTool("seed", [], env) !== 0) log(c("yellow", "Le chargement des questions a échoué (voir ci-dessus)."));

watch("API", start("api", "cyan", "uv", ["run", "--quiet", "--project", "api", "uvicorn", "cervo.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload", "--reload-dir", join(ROOT, "api", "cervo")], { env }));
watch("Front", start("web", "green", "npm", ["run", "dev", "--workspace", "web"], { env }));

try {
  await waitFor("http://127.0.0.1:8000/api/health", 60000, "L'API");
  await waitFor("http://localhost:5173", 60000, "Le front");
  const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === "IPv4" && !i.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(i.address));
  console.log(`
${c("bold", "  Vif est prêt")}  →  ${c("green", "http://localhost:5173")}${lan ? `
  ${c("dim", "Sur ton téléphone (même Wi-Fi) :")} ${c("green", `http://${lan.address}:5173`)}` : ""}
  ${c("dim", "API : http://localhost:8000/api/docs · Émulateurs : http://127.0.0.1:4000 · Ctrl+C pour arrêter")}
`);
} catch (err) {
  log(c("red", err.message));
  stopAll(1);
}
