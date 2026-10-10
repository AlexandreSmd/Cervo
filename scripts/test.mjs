// npm test : tests pytest (API, avec l'émulateur Firestore) puis Vitest (front).
import { FIREBASE_BIN, emulatorHosts, isUp, loadEnv, log, run } from "./lib.mjs";

const env = { ...loadEnv(), FIRESTORE_PROJECT_ID: "demo-cervo-test", APP_ENV: "local" };
const hosts = emulatorHosts(env);
const pytest = ["run", "--quiet", "--project", "api", "pytest", "api/tests", "-q"];

let code;
if (await isUp(hosts.firestore) && await isUp(hosts.auth)) {
  log("Émulateurs déjà lancés : tests de l'API sur une base Firestore de test séparée.");
  code = run("uv", pytest, { env });
} else {
  log("Tests de l'API (émulateurs Firebase temporaires)…");
  code = run(process.execPath, [FIREBASE_BIN, "emulators:exec", "--only", "auth,firestore", "--project", env.FIREBASE_PROJECT_ID || "demo-cervo-daily", `uv ${pytest.join(" ")}`], { env, shell: false });
}
if (code !== 0) process.exit(code);

log("Tests du front (Vitest)…");
process.exit(run("npm", ["run", "test", "--workspace", "web"], { env }));
