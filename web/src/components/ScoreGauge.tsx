import { useEffect, useState } from "react";
import { COLOR_HEX, scoreColor } from "../lib/format";

/** Jauge circulaire animée pour un score de 0 à 100. */
export function ScoreGauge({ score, size = 132, label }: { score: number; size?: number; label?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 700;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(score * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const color = COLOR_HEX[scoreColor(score)];
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - shown / 100)} />
      </svg>
      <div className="absolute text-center" aria-live="polite">
        <div className="font-display text-4xl font-extrabold" data-testid="score-value">{shown}</div>
        <div className="text-xs font-semibold text-muted">{label ?? "/ 100"}</div>
      </div>
    </div>
  );
}
