import { Link } from "react-router-dom";
import { COLOR_HEX, formatDay, scoreColor } from "../lib/format";

/** Courbe des scores sur 30 jours (SVG maison). */
export function LineChart({ data }: { data: { date: string; score: number | null }[] }) {
  const w = 520, h = 160, pad = 20;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, data.length - 1);
  const y = (s: number) => h - pad - (s / 100) * (h - 2 * pad);
  const segments: string[] = [];
  let current = "";
  data.forEach((d, i) => {
    if (d.score === null) { if (current) segments.push(current); current = ""; return; }
    current += `${current ? "L" : "M"}${x(i).toFixed(1)},${y(d.score).toFixed(1)}`;
  });
  if (current) segments.push(current);
  const played = data.filter((d) => d.score !== null);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={`Évolution sur 30 jours : ${played.length} jours joués`}>
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={pad} x2={w - pad} y1={y(v)} y2={y(v)} stroke="rgb(var(--line))" strokeDasharray="4 4" />
          <text x={2} y={y(v) + 4} fontSize="10" fill="rgb(var(--muted))">{v}</text>
        </g>
      ))}
      {segments.map((d, i) => <path key={i} d={d} fill="none" stroke="rgb(var(--accent))" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)}
      {data.map((d, i) => d.score !== null && (
        <circle key={d.date} cx={x(i)} cy={y(d.score)} r="4.5" fill={COLOR_HEX[scoreColor(d.score)]} stroke="rgb(var(--card))" strokeWidth="2">
          <title>{`${formatDay(d.date, "short")} : ${d.score}/100`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Calendrier façon heatmap : chaque jour joué est coloré selon son score. */
export function Heatmap({ days, today, weeks = 12 }: { days: { date: string; score: number }[]; today: string; weeks?: number }) {
  const byDate = new Map(days.map((d) => [d.date, d.score]));
  const end = new Date(`${today}T12:00:00Z`);
  const dow = (end.getUTCDay() + 6) % 7; // lundi = 0
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - dow - (weeks - 1) * 7);
  const cells: { date: string; score: number | undefined; future: boolean }[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    cells.push({ date: iso, score: byDate.get(iso), future: iso > today });
  }
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {cells.map((c) => {
          const label = `${formatDay(c.date)}${c.score !== undefined ? ` : ${c.score}/100` : ""}`;
          if (c.score === undefined) {
            return <span key={c.date} title={label} className={`aspect-square min-w-[14px] rounded-[4px] ${c.future ? "bg-transparent" : "bg-line/70"}`} />;
          }
          return (
            <Link key={c.date} to={`/profil/${c.date}`} title={label} aria-label={label}
              className="aspect-square min-w-[14px] rounded-[4px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ backgroundColor: COLOR_HEX[scoreColor(c.score)] }} />
          );
        })}
      </div>
    </div>
  );
}

/** Barres horizontales (score moyen par catégorie). */
export function Bars({ items }: { items: { label: string; value: number | null; hint?: string }[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-semibold">{it.label}</span>
            <span className="text-muted">{it.value ?? "—"}{it.value !== null && "/100"}{it.hint ? ` · ${it.hint}` : ""}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-line/70">
            <div className="h-full rounded-full transition-all" style={{ width: `${it.value ?? 0}%`, backgroundColor: COLOR_HEX[scoreColor(it.value ?? 0)] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
