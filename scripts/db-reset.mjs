// npm run db:reset : efface les données des émulateurs puis recharge les questions.
import { existsSync, rmSync } from "node:fs";
import { EMULATOR_DATA, apiTool, emulatorHosts, isUp, loadEnv, log } from "./lib.mjs";

const env = loadEnv();
const project = env.FIREBASE_PROJECT_ID || "demo-cervo-daily";
const hosts = emulatorHosts(env);

if (existsSync(EMULATOR_DATA)) {
  rmSync(EMULATOR_DATA, { recursive: true, force: true });
  log("Données sauvegardées des émulateurs supprimées (.emulator-data/).");
}

if (await isUp(hosts.firestore)) {
  await fetch(`${hosts.firestore}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: "DELETE" });
  if (await isUp(hosts.auth)) {
    await fetch(`${hosts.auth}/emulator/v1/projects/${project}/accounts`, { method: "DELETE" });
  }
  log("Firestore et Auth vidés dans les émulateurs en cours d'exécution.");
  process.exit(apiTool("seed", ["--force"], env));
} else {
  log("Les émulateurs ne tournent pas : les questions seront rechargées au prochain « npm run dev ».");
}
