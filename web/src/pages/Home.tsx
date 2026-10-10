import { Link } from "react-router-dom";
import { Pearls } from "../components/Pearls";
import { ErrorBox, Loading } from "../components/States";
import { APP_NAME, BASELINE } from "../lib/config";
import { capitalize, formatDay } from "../lib/format";
import { useToday } from "../lib/hooks";

export function Home() {
  const { data, isLoading, error, refetch } = useToday();
  const scores = data?.answers.map((a) => a.score) ?? [];
  const started = scores.length > 0 && !data?.completed;

  return (
    <div className="space-y-6">
      <section className="space-y-3 pt-2 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">{APP_NAME}</p>
        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{BASELINE}</h1>
        <p className="text-lg text-muted">10 questions par jour, sans aide. Un score honnête sur 100 et la preuve de ta progression.</p>
      </section>

      {isLoading || !data ? (
        error ? <ErrorBox message={(error as Error).message} onRetry={() => refetch()} /> : <Loading label="Préparation du quiz du jour…" />
      ) : (
        <section className="card space-y-5 p-6" aria-labelledby="quiz-du-jour">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="quiz-du-jour" className="text-2xl font-bold">Quiz du jour</h2>
              <p className="text-muted">{capitalize(formatDay(data.date))}</p>
            </div>
            {data.streak > 0 && (
              <div className="rounded-2xl bg-mid/15 px-3 py-2 text-center" aria-label={`Série de ${data.streak} jours`}>
                <div className="font-display text-xl font-extrabold">🔥 {data.streak}</div>
                <div className="text-[11px] font-semibold text-muted">{data.streak > 1 ? "jours de suite" : "jour"}</div>
              </div>
            )}
          </div>

          <Pearls scores={scores} size="lg" />

          {data.completed ? (
            <div className="space-y-4 text-center">
              <p className="text-muted">Quiz terminé. Ton score du jour :</p>
              <p className="font-display text-6xl font-extrabold" data-testid="home-score">{data.score_total}<span className="text-2xl text-muted">/100</span></p>
              <Link to={`/resultats/${data.date}`} className="btn-primary w-full text-lg">Voir le détail</Link>
              <p className="text-sm text-muted">Nouveau quiz demain à minuit (heure de Paris).</p>
            </div>
          ) : (
            <div className="space-y-4">
              <Link to="/jouer" className="btn-primary w-full text-lg" data-testid="start-quiz">
                {started ? `Reprendre (question ${scores.length + 1}/10)` : "Commencer le quiz du jour"}
              </Link>
              <p className="text-center text-sm text-muted">Environ 5 minutes · pas de chrono · une seule participation par jour</p>
            </div>
          )}
        </section>
      )}

      <section className="card space-y-2 border-accent/30 bg-accent/5 p-5" aria-label="Règle du jeu">
        <h2 className="text-lg font-bold">🧠 La règle : sans aide</h2>
        <p className="text-muted">
          Pas de moteur de recherche, pas d'assistant IA. Tu réponds de tête : c'est là que ton cerveau travaille vraiment.
          L'IA reste un super outil, ici on entraîne ce que tu gardes pour toi.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 text-sm">
        {[
          ["Raisonnement", "Déduire, repérer une règle"],
          ["Estimation", "Penser en ordres de grandeur"],
          ["Mémoire et culture", "Relier ce que tu sais"],
          ["Esprit critique", "Douter des idées reçues"],
        ].map(([title, text]) => (
          <div key={title} className="card p-4">
            <p className="font-display font-bold">{title}</p>
            <p className="text-muted">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
