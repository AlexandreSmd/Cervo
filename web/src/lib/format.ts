// Mise en forme : couleurs de score, nombres, dates, réponses selon leur type.
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
  if (Array.isArray(value)) return value.join(type === "recall" ? " · " : " → ");
  if (type === "percent") {
    const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
    if (Number.isFinite(n)) return `${formatNumber(n)} %`;
  }
  if (type === "size") {
    const n = Number(value);
    if (Number.isFinite(n)) return `× ${formatNumber(Math.round(n * 100) / 100)}`;
  }
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
  return new Intl.DateTimeFormat(
    "fr-FR",
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }
      : { day: "numeric", month: "short", timeZone: "UTC" },
  ).format(dt);
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Interprète la saisie numérique d'un joueur (« 1 234,5 », « 384400 »). */
export function parseNumberInput(raw: string): number | null {
  const cleaned = raw.replace(/[\s\u202F\u00A0]/g, "").replace(",", ".");
  if (!cleaned || !/^-?\d*\.?\d+(e-?\d+)?$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
