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

/** Radar à 4 axes : la « forme du cerveau » par pilier. */
export function PillarRadar({ pillars }: { pillars: { label: string; average: number | null }[] }) {
  const w = 340, h = 270, cx = w / 2, cy = h / 2, r = 90;
  const angle = (i: number) => (-Math.PI / 2) + (i * 2 * Math.PI) / pillars.length;
  const pt = (i: number, v: number) => [cx + Math.cos(angle(i)) * r * (v / 100), cy + Math.sin(angle(i)) * r * (v / 100)];
  const poly = pillars.map((p, i) => pt(i, p.average ?? 0).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mx-auto h-auto w-full max-w-[340px]" role="img"
      aria-label={pillars.map((p) => `${p.label} : ${p.average ?? "pas encore de données"}`).join(", ")}>
      {[25, 50, 75, 100].map((lv) => (
        <polygon key={lv} points={pillars.map((_, i) => pt(i, lv).join(",")).join(" ")} fill="none" stroke="rgb(var(--line))" />
      ))}
      {pillars.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgb(var(--line))" />; })}
      <polygon points={poly} fill="rgb(var(--accent) / 0.25)" stroke="rgb(var(--accent))" strokeWidth="2.5" strokeLinejoin="round" />
      {pillars.map((p, i) => {
        const [x, y] = pt(i, i % 2 ? 150 : 122);
        return (
          <text key={p.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="rgb(var(--ink))">
            <tspan x={x}>{p.label}</tspan>
            <tspan x={x} dy="13" fontWeight="400" fill="rgb(var(--muted))">{p.average ?? "—"}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
