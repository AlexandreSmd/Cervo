import { formatDay } from "./format";

/** Seuil du code couleur du partage : 🟢 à partir de 50 points (plus de la moitié), 🔴 en dessous. */
export const SHARE_GOOD_THRESHOLD = 50;

export function shareDot(score: number): string {
  return score >= SHARE_GOOD_THRESHOLD ? "🟢" : "🔴";
}

/** Message de partage : une ligne par question, sans dévoiler les questions ni les réponses. */
export function buildShareMessage(appName: string, date: string, total: number, scores: number[], streak: number, url: string): string {
  const good = scores.filter((s) => s >= SHARE_GOOD_THRESHOLD).length;
  const lines = [
    `🧠 ${appName} · ${formatDay(date, "short")}`,
    `Mon score : ${total}/100${streak > 1 ? ` · 🔥 ${streak} jours de suite` : ""}`,
    "",
    scores.map(shareDot).join(""),
    ...scores.map((s, i) => `${String(i + 1).padStart(2, " ")}. ${shareDot(s)} ${s}/100`),
    "",
    `${good}/10 questions réussies. Sans aide, zéro IA.`,
    `Tente ta chance : ${url}`,
  ];
  return lines.join("\n");
}

export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/** Copie dans le presse-papiers, avec repli pour les pages en http (téléphone sur le Wi-Fi local). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* repli ci-dessous */ }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  document.body.removeChild(area);
  return ok;
}

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

/**
 * Sur mobile : ouvre la feuille de partage du téléphone (Messenger, WhatsApp, SMS…).
 * Sinon : copie le message.
 */
export async function shareMessage(text: string, title: string): Promise<ShareOutcome> {
  if (isMobileDevice() && canNativeShare()) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
    }
  }
  return (await copyText(text)) ? "copied" : "failed";
}

/** Ouvre l'application Messenger (le message, déjà copié, se colle dans la conversation). */
export const MESSENGER_APP_URL = "fb-messenger://";
