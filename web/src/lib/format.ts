import type { Answer, QuestionType } from "./types";

export type ScoreColor = "good" | "mid" | "bad";

export function scoreColor(score: number): ScoreColor {
  if (score >= 80) return "good";
  if (score >= 40) return "mid";
  return "bad";
}

export const COLOR_HEX: Record<ScoreColor, string> = { good: "#1FA971", mid: "#F2A33A", bad: "#E5484D" };

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(value);
}

export function formatAnswer(value: Answer | null | undefined, type: QuestionType, unit?: string | null): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "binary") {
    if (value === true || value === "true") return "Vrai";
    if (value === false || value === "false") return "Faux";
  }
  if (type === "numeric") {
    const n = typeof value === "number" ? value : Number(String(value).replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(n)) return `${formatNumber(n)}${unit ? ` ${unit}` : ""}`;
  }
  if (typeof value === "number") return formatNumber(value);
  return String(value);
}

export function formatDay(date: string, style: "long" | "short" = "long"): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("fr-FR", style === "long"
    ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }
    : { day: "numeric", month: "short", timeZone: "UTC" }).format(dt);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Interprète la saisie numérique d'un joueur (« 1 234,5 », « 384400 »). */
export function parseNumberInput(raw: string): number | null {
  const cleaned = raw.replace(/[\s  ]/g, "").replace(",", ".");
  if (!cleaned || !/^-?\d*\.?\d+(e-?\d+)?$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function coachMessage(score: number): string {
  if (score === 100) return "Parfait, rien à redire.";
  if (score >= 80) return "Très bien vu !";
  if (score >= 40) return "Pas loin, ton intuition est sur la bonne piste.";
  return "Raté cette fois, mais tu sais maintenant. C'est comme ça qu'on progresse.";
}

export function dayMessage(score: number): string {
  if (score >= 85) return "Cerveau en pleine forme aujourd'hui.";
  if (score >= 65) return "Belle séance ! Ton cervo est bien affûté.";
  if (score >= 45) return "Bonne séance, chaque question te fait progresser.";
  return "Journée difficile ? Ce sont celles qui entraînent le plus. À demain !";
}
