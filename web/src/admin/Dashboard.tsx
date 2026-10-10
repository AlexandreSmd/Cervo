import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import type { DayStats, Overview } from "../lib/types";
import { CategoryDot, Kpi, Panel, Rate, shortDate } from "./ui";

function ActivityChart({ series, selected, onSelect }: { series: Overview["series"]; selected: string; onSelect: (d: string) => void }) {
  const w = 900, h = 220, pad = 28;
  const max = Math.max(10, ...series.map((s) => s.players));
  const bw = (w - pad * 2) / series.length;
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const ys = (v: number) => h - pad - (v / 100) * (h - pad * 2);
  const line = series.map((s, i) => (s.average === null ? null : `${pad + i * bw + bw / 2},${ys(s.average)}`)).filter(Boolean).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Joueurs et score moyen sur 30 jours">
      {series.map((s, i) => (
        <g key={s.date} onClick={() => onSelect(s.date)} className="cursor-pointer">
          <rect x={pad + i * bw + 3} y={pad} width={bw - 6} height={h - pad * 2} fill="transparent" />
          <rect x={pad + i * bw + 3} y={y(s.players)} width={bw - 6} height={Math.max(0, h - pad - y(s.players))} rx="5"
            fill={s.date === selected ? "rgb(var(--accent))" : "rgb(var(--ink) / 0.12)"}>
            <title>{`${shortDate(s.date)} : ${s.players} joueurs, score moyen ${s.average ?? "—"}`}</title>
          </rect>
        </g>
      ))}
      {line && <polyline points={line} fill="none" stroke="#F2A33A" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
      <text x={pad} y={14} fontSize="12" fill="rgb(var(--muted))">joueurs (barres) · score moyen (ligne)</text>
      <text x={pad} y={h - 8} fontSize="11" fill="rgb(var(--muted))">{shortDate(series[0].date)}</text>
      <text x={w - pad} y={h - 8} fontSize="11" fill="rgb(var(--muted))" textAnchor="end">aujourd'hui</text>
    </svg>
  );
}

function Distribution({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Répartition des scores du jour">
      {values.map((v, i) => (
        <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
          <div className="w-full rounded-md" style={{ height: `${(v / max) * 85}%`, minHeight: 2, backgroundColor: i >= 8 ? "#1FA971" : i >= 4 ? "#F2A33A" : "#E5484D" }} title={`${i * 10}–${i * 10 + 9} : ${v}`} />
          <span className="text-[10px] text-muted">{i * 10}</span>
        </div>
      ))}
    </div>
  );
}

function DayQuestions({ day }: { day: DayStats }) {
  if (!day.questions.length) return <p className="text-sm text-muted">Pas de quiz planifié ce jour-là.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted">
          <tr><th className="py-2 pr-2">#</th><th className="py-2 pr-4">Question</th><th className="py-2 pr-4">Format</th><th className="py-2 pr-4">Réponses</th><th className="py-2 pr-4">Moyenne</th><th className="py-2">Bonnes réponses</th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {day.questions.map((q) => (
            <tr key={q.id}>
              <td className="py-3 pr-2 font-bold text-muted">{q.position + 1}</td>
              <td className="py-3 pr-4"><span className="flex max-w-[460px] items-center gap-2"><CategoryDot category={q.category} /><span className="truncate">{q.prompt}</span></span></td>
              <td className="whitespace-nowrap py-3 pr-4 text-muted">{q.input_label} → {q.answer_label}</td>
              <td className="py-3 pr-4 tabular-nums">{q.answers}</td>
              <td className="py-3 pr-4 tabular-nums">{q.average ?? "—"}</td>
              <td className="py-3"><Rate value={q.success} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-overview"], queryFn: api.admin.overview });
  const [selected, setSelected] = useState<string | null>(null);
  const day = useQuery({ queryKey: ["admin-day", selected], queryFn: () => api.admin.dayStats(selected!), enabled: !!selected });

  if (error) return <ErrorBox message={(error as Error).message} />;
  if (isLoading || !data) return <Loading />;
  const current = selected && day.data ? day.data : data.today;
  const k = data.kpis;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-muted">{shortDate(data.today.date)}</p>
          <h1 className="text-4xl font-extrabold">Tableau de bord</h1>
        </div>
        {k.days_planned_ahead < 7 && (
          <Link to="/admin/planning" className="chip bg-mid/20 py-2">⚠ Seulement {k.days_planned_ahead} jour(s) planifié(s) : planifier →</Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi accent label="Joueurs aujourd'hui" value={k.players_today} />
        <Kpi label="Score moyen" value={data.today.average ?? "—"} hint="aujourd'hui" />
        <Kpi label="Terminent le quiz" value={data.today.completion !== null ? `${data.today.completion}%` : "—"} />
        <Kpi label="Joueurs 7 jours" value={k.players_7d} hint="parties commencées" />
        <Kpi label="Inscrits" value={k.total_users} hint="sessions et comptes" />
        <Kpi label="Planifié" value={`${k.days_planned_ahead} j`} hint={`${k.questions_published} questions publiées`} />
      </div>

      <Panel title="30 derniers jours" action={<span className="text-xs text-muted">Clique sur un jour pour le détail</span>}>
        <ActivityChart series={data.series} selected={current.date} onSelect={setSelected} />
      </Panel>

      <Panel title={`Questions du ${shortDate(current.date)}`}
        action={<span className="text-sm text-muted">{current.players} joueurs · {current.completed} terminés</span>}>
        <DayQuestions day={current} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title={`Scores du ${shortDate(current.date)}`}>
          <Distribution values={current.distribution} />
          <p className="mt-3 text-sm text-muted">Score moyen : <strong className="text-ink">{current.average ?? "—"}</strong></p>
        </Panel>
        {([["Les plus dures", data.hardest], ["Les plus faciles", data.easiest]] as const).map(([title, list]) => (
          <Panel key={title} title={title}>
            {list.length === 0 ? <p className="text-sm text-muted">Pas encore assez de réponses.</p> : (
              <ul className="divide-y divide-line">
                {list.map((q) => (
                  <li key={q.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <CategoryDot category={q.category} />
                    <span className="flex-1 truncate">{q.prompt}</span>
                    <span className="text-muted tabular-nums">moy. {q.average}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        ))}
      </div>
      {k.reports > 0 && <Link to="/admin/signalements" className="chip bg-bad/10 py-2 text-bad">⚑ {k.reports} signalement(s) à traiter</Link>}
    </div>
  );
}
