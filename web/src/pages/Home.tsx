// Accueil : quiz du jour, série, bouton commencer ou score du jour.
import { Link } from "react-router-dom";
import { Pearls } from "../components/Pearls";
import { ErrorBox, Loading } from "../components/States";
import { BASELINE } from "../lib/config";
import { capitalize, formatDay } from "../lib/format";
import { useToday } from "../lib/hooks";

export function Home() {
  const { data, isLoading, error, refetch } = useToday();
  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Loading />;

  const scores = data.answers.map((a) => a.score);
  const started = scores.length > 0 && !data.completed;

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted">{capitalize(formatDay(data.date))}</p>
        {data.streak > 0 && (
          <span className="chip bg-mid/15" aria-label={`Série de ${data.streak} jours`}>
            🔥 {data.streak}
          </span>
        )}
      </div>
      <h1 className="text-[40px] font-extrabold leading-[1.05]">{BASELINE}</h1>

      <section className="card space-y-6 p-6" aria-label="Quiz du jour">
        {data.completed ? (
          <div className="text-center">
            <p className="text-sm font-semibold text-muted">Score du jour</p>
            <p className="font-display text-7xl font-extrabold" data-testid="home-score">
              {data.score_total}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-muted">Quiz du jour</p>
            <p className="font-display text-3xl font-extrabold">10 questions</p>
          </div>
        )}
        <Pearls scores={scores} size="lg" />
        {data.completed ? (
          <Link to={`/resultats/${data.date}`} className="btn-dark w-full text-lg">
            Voir le détail
          </Link>
        ) : (
          <Link to="/jouer" className="btn-primary w-full text-lg" data-testid="start-quiz">
            {started ? `Reprendre · ${scores.length + 1}/10` : "Commencer"}
          </Link>
        )}
      </section>
      <p className="text-center text-sm text-muted">{data.completed ? "Nouveau quiz à minuit" : "Sans aide · 15 s par question"}</p>
    </div>
  );
}
