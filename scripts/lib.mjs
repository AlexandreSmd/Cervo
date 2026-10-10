// Utilitaires partagés par les scripts npm (Node uniquement : macOS, Linux, Windows).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const IS_WINDOWS = process.platform === "win32";
export const FIREBASE_BIN = join(ROOT, "node_modules", "firebase-tools", "lib", "bin", "firebase.js");
export const EMULATOR_DATA = join(ROOT, ".emulator-data");

const COLORS = { reset: "\x1b[0m", dim: "\x1b[2m", bold: "\x1b[1m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m" };
export const c = (color, text) => (process.stdout.isTTY ? `${COLORS[color]}${text}${COLORS.reset}` : text);

export function log(message) {
  console.log(`${c("magenta", "[vif]")} ${message}`);
}

/** Lit .env.local (ou .env.example à défaut) et le fusionne avec l'environnement courant. */
export function loadEnv() {
  const file = existsSync(join(ROOT, ".env.local")) ? join(ROOT, ".env.local") : join(ROOT, ".env.example");
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return { ...env, ...process.env };
}

export function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, shell: IS_WINDOWS && !cmd.endsWith(".exe"), ...options });
  return result.status ?? 1;
}

export function capture(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8", shell: IS_WINDOWS });
  if (result.error || result.status !== 0) return null;
  return `${result.stdout || ""}${result.stderr || ""}`.trim();
}

/** Lance un processus long en préfixant chaque ligne de sortie. */
export function start(name, color, cmd, args, options = {}) {
  const child = spawn(cmd, args, { cwd: ROOT, shell: IS_WINDOWS, ...options, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = c(color, `[${name}]`.padEnd(7));
  const pipe = (stream, out) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) if (line.trim()) out.write(`${prefix} ${line}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  return child;
}

export async function isUp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.status < 500;
  } catch {
    return false;
  }
}

export async function waitFor(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isUp(url)) return true;
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(`${label} ne répond pas sur ${url} après ${Math.round(timeoutMs / 1000)} s.`);
}

/** Exécute un outil Python de l'API : uv run --project api python -m cervo.tools.<name>. */
export function apiTool(name, args = [], env = loadEnv()) {
  return run("uv", ["run", "--quiet", "--project", "api", "python", "-m", `cervo.tools.${name}`, ...args], { env });
}

export function emulatorHosts(env) {
  return {
    firestore: `http://${env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080"}`,
    auth: `http://${env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099"}`,
  };
}
