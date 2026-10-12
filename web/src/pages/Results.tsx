// Résultats d'une journée : score, perles, partage, détail des questions.
import { useEffect } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { DayItems } from "../components/DayItems";
import { Pearls } from "../components/Pearls";
import { ShareCard } from "../components/ShareCard";
import { ErrorBox, Loading } from "../components/States";
import { ApiError } from "../lib/api";
import { APP_NAME, BASELINE } from "../lib/config";
import { COLOR_HEX, capitalize, formatDay, scoreColor } from "../lib/format";
import { useResults, useToday } from "../lib/hooks";

export function Results() {
  const { date = "" } = useParams();
  const { data, isLoading, error } = useResults(date);
  const today = useToday();

  useEffect(() => {
    document.title = data ? `${data.score_total}/100 · ${APP_NAME}` : APP_NAME;
    return () => {
      document.title = `${APP_NAME} — ${BASELINE}`;
    };
  }, [data]);

  if (error instanceof ApiError && error.status === 409) return <Navigate to="/jouer" replace />;
  if (error) return <ErrorBox message={(error as Error).message} />;
  if (isLoading || !data) return <Loading />;

  const scores = data.items.map((i) => i.score);
  const streak = today.data?.date === date ? (today.data?.streak ?? 0) : 0;

  return (
    <div className="space-y-4 pt-4">
      <section className="card space-y-6 p-6" data-testid="day-score">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-muted">{capitalize(formatDay(date))}</p>
            <p className="font-display text-7xl font-extrabold" style={{ color: COLOR_HEX[scoreColor(data.score_total)] }}>
              {data.score_total}
            </p>
          </div>
          {streak > 0 && <span className="chip bg-mid/15">🔥 {streak}</span>}
        </div>
        <Pearls scores={scores} size="lg" />
        <ShareCard
          date={date}
          total={data.score_total}
          scores={scores}
          streak={streak}
          kinds={data.items.map((i) => ({ emoji: i.emoji ?? "❔", label: i.category_label }))}
        />
      </section>
      <DayItems items={data.items} />
      <Link to="/profil" className="btn-ghost w-full" data-testid="to-profile">
        Mon profil
      </Link>
    </div>
  );
}

export function PastDay() {
  const { date = "" } = useParams();
  const { data, isLoading, error } = useResults(date);
  if (error) return <ErrorBox message={(error as Error).message} />;
  if (isLoading || !data) return <Loading />;
  return (
    <div className="space-y-4 pt-4">
      <Link to="/profil" className="chip">
        ← Profil
      </Link>
      <section className="card space-y-4 p-6">
        <p className="text-sm font-semibold text-muted">{capitalize(formatDay(date))}</p>
        <p className="font-display text-6xl font-extrabold" style={{ color: COLOR_HEX[scoreColor(data.score_total)] }}>
          {data.score_total}
        </p>
        <Pearls scores={data.items.map((i) => i.score)} />
      </section>
      <DayItems items={data.items} />
    </div>
  );
}
