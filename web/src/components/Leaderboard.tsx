// Classement du mois : la tête du classement, ta ligne, et ce que le quiz du jour a changé.
import { Link } from "react-router-dom";
import type { Leaderboard, LeaderboardRow } from "../lib/types";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 2026-10 » → « octobre ». */
export function monthLabel(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1] ?? month;
}

/** Ce que la journée a changé, en clair : « ▲ 3 places », « ▼ 1 place », « = », « nouveau ». */
export function changeLabel(row: Pick<LeaderboardRow, "change" | "previous_rank">): { text: string; tone: "good" | "bad" | "muted" } {
  if (row.previous_rank === null || row.change === null) return { text: "nouveau", tone: "good" };
  if (row.change === 0) return { text: "=", tone: "muted" };
  const n = Math.abs(row.change);
  return { text: `${row.change > 0 ? "▲" : "▼"} ${n} place${n > 1 ? "s" : ""}`, tone: row.change > 0 ? "good" : "bad" };
}

const TONE = { good: "text-good", bad: "text-bad", muted: "text-muted" } as const;

function Change({ row }: { row: LeaderboardRow }) {
  const { text, tone } = changeLabel(row);
  return <span className={`text-xs font-bold ${TONE[tone]}`}>{text}</span>;
}

function medal(rank: number): string {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
}

function Row({ row }: { row: LeaderboardRow }) {
  return (
    <li
      className={`flex items-center gap-3 px-5 py-3 ${row.is_me ? "bg-accent/10" : ""}`}
      data-testid={row.is_me ? "leaderboard-me" : undefined}
      aria-current={row.is_me ? "true" : undefined}
    >
      <span className="w-8 shrink-0 text-center font-display text-lg font-extrabold tabular-nums">{medal(row.rank)}</span>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-semibold ${row.is_me ? "text-accent" : ""}`}>
          {row.username}
          {row.is_me && <span className="ml-1.5 text-xs font-bold text-muted">(toi)</span>}
        </p>
        <p className="text-xs text-muted">
          {row.days} jour{row.days > 1 ? "s" : ""} · <Change row={row} />
        </p>
      </div>
      <span className="shrink-0 text-right font-display font-extrabold tabular-nums">{row.total}</span>
    </li>
  );
}

/** Ta place, en grand : rang, total et mouvement depuis le quiz du jour. */
export function MyRank({ data, link = false }: { data: Leaderboard; link?: boolean }) {
  const me = data.me;
  const body = me ? (
    <>
      <div>
        <p className="text-sm font-semibold text-muted">Classement de {monthLabel(data.month)}</p>
        <p className="font-display text-4xl font-extrabold">
          {me.rank}
          <span className="text-xl">{me.rank === 1 ? "er" : "e"}</span>
          <span className="ml-2 text-base font-semibold text-muted">sur {data.players}</span>
        </p>
        <p className="text-sm text-muted">{me.total} points ce mois-ci</p>
      </div>
      <div className="text-right">
        <p className={`font-display text-xl font-extrabold ${TONE[changeLabel(me).tone]}`} data-testid="rank-change">
          {changeLabel(me).text}
        </p>
        <p className="text-xs font-semibold text-muted">{me.played_today ? "avec le quiz du jour" : "aujourd'hui"}</p>
      </div>
    </>
  ) : (
    <div>
      <p className="text-sm font-semibold text-muted">Classement de {monthLabel(data.month)}</p>
      <p className="font-bold">Termine un quiz pour entrer dans le classement.</p>
    </div>
  );
  const className = "card flex items-center justify-between gap-4 p-5";
  return link ? (
    <Link to="/profil?onglet=classement" className={className} data-testid="my-rank">
      {body}
    </Link>
  ) : (
    <section className={className} data-testid="my-rank">
      {body}
    </section>
  );
}

export function LeaderboardList({ data }: { data: Leaderboard }) {
  const meShown = data.rows.some((r) => r.is_me);
  return (
    <section className="card overflow-hidden" aria-labelledby="classement" data-testid="leaderboard">
      <div className="px-5 pb-3 pt-5">
        <h2 id="classement" className="text-lg font-bold">
          Top du mois
        </h2>
        <p className="text-sm text-muted">Les points de tous tes quiz du mois s'additionnent : chaque jour compte.</p>
      </div>
      <ol className="divide-y divide-line border-t border-line">
        {data.rows.map((row) => (
          <Row key={`${row.rank}-${row.username}`} row={row} />
        ))}
        {data.me && !meShown && (
          <>
            <li className="px-5 py-1 text-center text-muted" aria-hidden="true">
              ⋯
            </li>
            <Row row={data.me} />
          </>
        )}
        {data.rows.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Personne n'a encore joué ce mois-ci</li>}
      </ol>
    </section>
  );
}
