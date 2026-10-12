// Temps restant avant le prochain quiz (minuit, heure de Paris).
import { useEffect, useState } from "react";

/** Millisecondes jusqu'à minuit à Paris. */
export function msToParisMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const elapsed = (get("hour") * 3600 + get("minute") * 60 + get("second")) * 1000 + now.getMilliseconds();
  return 86_400_000 - elapsed;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

export function Countdown() {
  const [left, setLeft] = useState(msToParisMidnight);
  useEffect(() => {
    const id = window.setInterval(() => setLeft(msToParisMidnight()), 20_000);
    return () => window.clearInterval(id);
  }, []);
  return <span data-testid="countdown">Prochain quiz dans {formatCountdown(left)}</span>;
}
