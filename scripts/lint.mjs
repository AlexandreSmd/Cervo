// npm run lint : qualité du code, Python (Ruff) et TypeScript (ESLint, Prettier, tsc).
// npm run lint -- --fix : corrige et reformate automatiquement ce qui peut l'être.
import { log, run } from "./lib.mjs";

const fix = process.argv.includes("--fix");
const steps = fix
  ? [
      ["Python : corrections (Ruff)", "uv", ["run", "--quiet", "--project", "api", "ruff", "check", "api", "--fix"]],
      ["Python : mise en forme (Ruff)", "uv", ["run", "--quiet", "--project", "api", "ruff", "format", "api"]],
      ["TypeScript : corrections (ESLint)", "npx", ["--workspace", "web", "eslint", ".", "--fix"]],
      ["TypeScript : mise en forme (Prettier)", "npm", ["run", "format", "--workspace", "web"]],
    ]
  : [
      ["Python : règles (Ruff)", "uv", ["run", "--quiet", "--project", "api", "ruff", "check", "api"]],
      ["Python : mise en forme (Ruff)", "uv", ["run", "--quiet", "--project", "api", "ruff", "format", "--check", "api"]],
      ["TypeScript : règles, mise en forme et types", "npm", ["run", "lint", "--workspace", "web"]],
    ];

for (const [label, cmd, args] of steps) {
  log(label);
  const code = run(cmd, args);
  if (code !== 0) {
    log(fix ? "Échec." : "Problème détecté. Essaie « npm run format » pour corriger automatiquement.");
    process.exit(code);
  }
}
log(fix ? "Code corrigé et reformaté." : "Code propre.");
