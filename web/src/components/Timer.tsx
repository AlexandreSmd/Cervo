// Chrono d'une question (démarré côté serveur, voir services/play.py).
import { useEffect, useState } from "react";

/** Barre de chrono : se vide en `limit` secondes à partir de `startedAt` (heure serveur corrigée). */
export function Timer({ startedAt, limit, onExpire, paused }: { startedAt: number; limit: number; onExpire: () => void; paused: boolean }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [paused]);
  const left = Math.max(0, limit - (now - startedAt) / 1000);
  useEffect(() => {
    if (!paused && left <= 0) onExpire();
  }, [left, paused, onExpire]);
  const urgent = left <= 5;
  return (
    <div className="flex items-center gap-3" role="timer" aria-label={`${Math.ceil(left)} secondes restantes`} data-testid="timer">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${urgent ? "bg-bad" : "bg-ink"}`}
          style={{ width: `${(left / limit) * 100}%` }}
        />
      </div>
      <span className={`w-8 text-right font-display text-lg font-extrabold tabular-nums ${urgent ? "text-bad" : ""}`}>
        {Math.ceil(left)}
      </span>
    </div>
  );
}
