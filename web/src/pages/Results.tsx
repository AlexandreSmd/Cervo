import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { DayItems } from "../components/DayItems";
import { Pearls } from "../components/Pearls";
import { ScoreGauge } from "../components/ScoreGauge";
import { ShareCard } from "../components/ShareCard";
import { ErrorBox, Loading } from "../components/States";
import { ApiError } from "../lib/api";
import { APP_NAME } from "../lib/config";
import { capitalize, dayMessage, formatDay } from "../lib/format";
import { useResults, useToday } from "../lib/hooks";

export function Results() {
  const { date = "" } = useParams();
  const { data, isLoading, error } = useResults(date);
  const today = useToday();

  useEffect(() => {
    document.title = data ? `${data.score_total}/100 · ${APP_NAME}` : `Résultats · ${APP_NAME}`;
    return () => { document.title = `${APP_NAME} — Garde ton cervo affûté`; };
  }, [data]);

  if (error instanceof ApiError && error.status === 409) return <Navigate to="/jouer" replace />;
  if (error) return <ErrorBox message={(error as Error).message} />;
  if (isLoading || !data) return <Loading />;

  const scores = data.items.map((i) => i.score);
  const isToday = today.data?.date === date;
  const streak = isToday ? today.data?.streak ?? 0 : 0;

  return (
    <div className="space-y-6">
      <section className="card space-y-5 p-6 text-center">
        <p className="text-sm font-semibold text-muted">{capitalize(formatDay(date))}</p>
        <h1 className="text-3xl font-extrabold">Score du jour</h1>
        <div className="flex justify-center" data-testid="day-score"><ScoreGauge score={data.score_total} size={170} /></div>
        <p className="font-display text-lg font-bold">{dayMessage(data.score_total)}</p>
        <Pearls scores={scores} size="lg" />
        {streak > 0 && <p className="text-muted">🔥 Série : <strong className="text-ink">{streak} jour{streak > 1 ? "s" : ""}</strong> de suite</p>}
        <ShareCard date={date} total={data.score_total} scores={scores} streak={streak} />
        <Link to="/profil" className="btn-ghost w-full" data-testid="to-profile">Voir mon profil</Link>
        {isToday && <p className="text-sm text-muted">Rendez-vous demain pour un nouveau quiz !</p>}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Détail des questions</h2>
        <DayItems items={data.items} />
      </section>
    </div>
  );
}

export function PastDay() {
  const { date = "" } = useParams();
  const { data, isLoading, error } = useResults(date);
  if (error) return <ErrorBox message={(error as Error).message} />;
  if (isLoading || !data) return <Loading />;
  return (
    <div className="space-y-5">
      <Link to="/profil" className="link text-sm">← Retour au profil</Link>
      <section className="card flex items-center justify-between gap-4 p-5">
        <div>
          <h1 className="text-2xl font-extrabold">{capitalize(formatDay(date))}</h1>
          <p className="text-muted">Score du jour : <strong className="text-ink">{data.score_total}/100</strong></p>
        </div>
        <div className="w-40"><Pearls scores={data.items.map((i) => i.score)} size="sm" /></div>
      </section>
      <DayItems items={data.items} />
    </div>
  );
}
