// npm run setup : vérifie les prérequis, installe les dépendances, crée .env.local.
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { ROOT, c, capture, log, run } from "./lib.mjs";

const platform = process.platform === "darwin" ? "mac" : process.platform === "win32" ? "windows" : "linux";
const INSTALL = {
  node: { mac: "brew install node@22", linux: "curl -fsSL https://fnm.vercel.app/install | bash && fnm install 22", windows: "winget install OpenJS.NodeJS.LTS" },
  uv: { mac: "curl -LsSf https://astral.sh/uv/install.sh | sh", linux: "curl -LsSf https://astral.sh/uv/install.sh | sh", windows: 'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"' },
  java: { mac: "brew install openjdk@21", linux: "sudo apt install -y openjdk-21-jre-headless", windows: "winget install Microsoft.OpenJDK.21" },
  git: { mac: "xcode-select --install", linux: "sudo apt install -y git", windows: "winget install Git.Git" },
  gh: { mac: "brew install gh", linux: "sudo apt install -y gh", windows: "winget install GitHub.cli" },
};

const problems = [];
const ok = (label, detail) => console.log(`  ${c("green", "✓")} ${label} ${c("dim", detail || "")}`);
const fail = (tool, label, detail) => {
  console.log(`  ${c("red", "✗")} ${label} ${c("dim", detail || "")}`);
  problems.push(`${label} : ${INSTALL[tool][platform]}`);
};
const warn = (label, detail) => console.log(`  ${c("yellow", "!")} ${label} ${c("dim", detail || "")}`);

log("Vérification des prérequis");
const nodeMajor = Number(process.versions.node.split(".")[0]);
nodeMajor >= 20 ? ok("Node.js", process.versions.node) : fail("node", "Node.js 20 ou plus", `trouvé ${process.versions.node}`);

const uv = capture("uv", ["--version"]);
uv ? ok("uv", uv.split("\n").pop()) : fail("uv", "uv", "introuvable");

const java = capture("java", ["-version"]);
const javaMajor = java ? Number((java.match(/version "(\d+)(?:\.(\d+))?/) || [])[1] === "1" ? (java.match(/version "1\.(\d+)/) || [])[1] : (java.match(/version "(\d+)/) || [])[1]) : 0;
javaMajor >= 17 ? ok("Java", `version ${javaMajor}`) : fail("java", "Java 17 ou plus (émulateur Firestore)", java ? `trouvé ${javaMajor}` : "introuvable");

const git = capture("git", ["--version"]);
git ? ok("Git", git) : fail("git", "Git", "introuvable");

if (uv) {
  const py = capture("uv", ["python", "find", ">=3.12"]);
  py ? ok("Python 3.12+", py) : warn("Python 3.12+", "absent : uv le téléchargera automatiquement (uv python install 3.12)");
}
const gh = capture("gh", ["--version"]);
gh ? ok("GitHub CLI", gh.split("\n")[0]) : warn("GitHub CLI (facultatif)", `pour installer : ${INSTALL.gh[platform]}`);

if (problems.length) {
  console.log(`\n${c("red", "Il manque des prérequis.")} Commandes d'installation pour ton système :`);
  for (const p of problems) console.log(`  - ${p}`);
  console.log("Relance ensuite « npm run start:local ».");
  process.exit(1);
}

// Dépendances Node : on ne relance npm install que si package*.json a changé.
const stampFile = join(ROOT, "node_modules", ".cervo-stamp");
const hash = createHash("sha256");
for (const f of ["package.json", "package-lock.json", "web/package.json"]) {
  if (existsSync(join(ROOT, f))) hash.update(readFileSync(join(ROOT, f)));
}
const digest = hash.digest("hex");
if (!existsSync(stampFile) || readFileSync(stampFile, "utf8") !== digest) {
  log("Installation des dépendances Node (npm install)…");
  if (run("npm", ["install", "--no-fund", "--no-audit"]) !== 0) process.exit(1);
  writeFileSync(stampFile, digest);
} else {
  ok("Dépendances Node", "à jour");
}

log("Installation des dépendances Python (uv sync)…");
if (run("uv", ["sync", "--quiet", "--project", "api"]) !== 0) process.exit(1);
ok("Dépendances Python", "à jour");

if (!existsSync(join(ROOT, ".env.local"))) {
  copyFileSync(join(ROOT, ".env.example"), join(ROOT, ".env.local"));
  ok(".env.local", "créé depuis .env.example");
} else {
  ok(".env.local", "déjà présent");
}
log(c("green", "Setup terminé."));
