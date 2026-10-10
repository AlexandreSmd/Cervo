// npm run questions:check | questions:import | db:seed:demo → outils Python de l'API.
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { apiTool, emulatorHosts, isUp, loadEnv, log } from "./lib.mjs";

const [name, ...rest] = process.argv.slice(2);
const env = loadEnv();
const args = rest.map((a) => (!a.startsWith("-") && existsSync(resolve(process.cwd(), a)) ? resolve(process.cwd(), a) : a));

if (name !== "check" && env.APP_ENV === "local") {
  const { firestore } = emulatorHosts(env);
  if (!(await isUp(firestore))) {
    log("L'émulateur Firestore ne tourne pas. Lance d'abord « npm run dev » dans un autre terminal.");
    process.exit(1);
  }
}
if (name === "import_questions" && args.length === 0) {
  log("Usage : npm run questions:import -- chemin/vers/questions.json [--overwrite]");
  process.exit(1);
}
process.exit(apiTool(name, args, env));
