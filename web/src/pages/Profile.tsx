import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "firebase/auth";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bars, Heatmap, LineChart, PillarRadar } from "../components/Charts";
import { ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import { auth } from "../lib/firebase";
import { COLOR_HEX, capitalize, formatAnswer, formatDay, scoreColor } from "../lib/format";
import { useDays, useProfile } from "../lib/hooks";

const PILLAR_SHORT: Record<string, string> = {
  raisonnement: "Raisonnement", estimation: "Estimation", memoire: "Mémoire", esprit_critique: "Esprit critique",
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl bg-bg p-3 text-center">
      <div className="font-display text-2xl font-extrabold">{value}</div>
      <div className="text-xs font-semibold text-muted">{label}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

function Username({ current }: { current: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.setUsername(value.trim());
      await qc.invalidateQueries();
      setEditing(false);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-extrabold" data-testid="username">{current}</h1>
        <button className="link text-sm" onClick={() => { setValue(current); setEditing(true); }}>Modifier</button>
      </div>
    );
  }
  return (
    <form onSubmit={save} className="space-y-2">
      <label htmlFor="username" className="label">Ton pseudo (3 à 24 caractères)</label>
      <div className="flex gap-2">
        <input id="username" className="input" value={value} onChange={(e) => setValue(e.target.value)} minLength={3} maxLength={24} pattern="[A-Za-z0-9À-ÿ_.\-]+" required />
        <button className="btn-primary" type="submit">OK</button>
      </div>
      {error && <p className="text-sm text-bad" role="alert">{error}</p>}
    </form>
  );
}

export function Profile() {
  const { data: p, isLoading, error, refetch } = useProfile();
  const days = useDays();
  const [catFilter, setCatFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shown, setShown] = useState(10);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const review = useMemo(() => {
    const all = (days.data?.days ?? []).flatMap((d) => d.answers.map((a) => ({ ...a, date: d.date })));
    return all.filter((a) =>
      (catFilter === "all" || a.category === catFilter) &&
      (scoreFilter === "all" || scoreColor(a.score) === scoreFilter));
  }, [days.data, catFilter, scoreFilter]);

  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;
  if (isLoading || !p) return <Loading />;

  const best = p.categories[0];
  const worst = p.categories.length > 1 ? p.categories[p.categories.length - 1] : null;
  const catLabels = new Map(p.categories.map((c) => [c.category, c.label]));

  const deleteAccount = async () => {
    await api.deleteAccount();
    await signOut(auth);
    qc.clear();
    navigate("/");
  };

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-6">
        <Username current={p.username} />
        <p className="text-sm text-muted">
          {p.is_anonymous ? "Session invité : ton historique est gardé sur cet appareil." : `Connecté avec ${p.email}`}
          {p.is_admin && <> · <Link to="/admin" className="link">Admin</Link></>}
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="jours joués" value={p.days_played} />
          <Stat label="score moyen" value={p.average ?? "—"} />
          <Stat label="série actuelle" value={`🔥 ${p.current_streak}`} />
          <Stat label="record de série" value={p.best_streak} />
        </div>
        {p.is_anonymous && (
          <div className="rounded-2xl bg-accent/10 p-4">
            <p className="font-semibold">Garde ta progression sur tous tes appareils</p>
            <p className="text-sm text-muted">Crée un compte avec ton e-mail : ton historique d'invité est conservé.</p>
            <Link to="/connexion" className="btn-primary mt-3 w-full" data-testid="create-account">Créer mon compte</Link>
          </div>
        )}
      </section>

      {p.days_played === 0 ? (
        <section className="card p-6 text-center">
          <p className="font-display text-xl font-bold">Ton profil se remplira dès ton premier quiz.</p>
          <Link to="/jouer" className="btn-primary mt-4">Jouer le quiz du jour</Link>
        </section>
      ) : (
        <>
          <section className="card space-y-2 p-6" aria-labelledby="forme">
            <h2 id="forme" className="text-xl font-bold">La forme de ton cerveau</h2>
            <p className="text-sm text-muted">Score moyen par pilier d'entraînement.</p>
            <PillarRadar pillars={p.pillars.map((x) => ({ label: PILLAR_SHORT[x.pillar] ?? x.label, average: x.average }))} />
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {p.pillars.map((x) => (
                <li key={x.pillar} className="rounded-xl bg-bg px-3 py-2">
                  <span className="font-semibold">{PILLAR_SHORT[x.pillar]}</span>{" "}
                  {x.trend !== null && (
                    <span className={x.trend >= 0 ? "text-good" : "text-bad"} title="Évolution sur les 7 derniers jours">
                      {x.trend >= 0 ? "▲" : "▼"} {Math.abs(x.trend)}
                    </span>
                  )}
                  <span className="block text-xs text-muted">{x.count} réponse{x.count > 1 ? "s" : ""}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card space-y-3 p-6" aria-labelledby="evolution">
            <h2 id="evolution" className="text-xl font-bold">Évolution sur 30 jours</h2>
            <LineChart data={p.last_30_days} />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="meilleur jour" value={p.best_day?.score ?? "—"} hint={p.best_day ? formatDay(p.best_day.date, "short") : undefined} />
              <Stat label="jour le plus dur" value={p.worst_day?.score ?? "—"} hint={p.worst_day ? formatDay(p.worst_day.date, "short") : undefined} />
              <Stat label="bonnes réponses" value={p.correct_rate !== null ? `${p.correct_rate} %` : "—"} hint="vrai/faux, QCM, réponses courtes" />
              <Stat label="précision" value={p.numeric_precision ?? "—"} hint="moyenne des estimations" />
            </div>
          </section>

          <section className="card space-y-3 p-6" aria-labelledby="calendrier">
            <h2 id="calendrier" className="text-xl font-bold">Calendrier</h2>
            <p className="text-sm text-muted">Chaque case colorée est un jour joué. Clique pour revoir la journée.</p>
            <Heatmap days={(days.data?.days ?? []).map((d) => ({ date: d.date, score: d.score_total }))} today={p.today} />
          </section>

          <section className="card space-y-3 p-6" aria-labelledby="categories">
            <h2 id="categories" className="text-xl font-bold">Par catégorie</h2>
            {best && worst && (
              <p className="text-sm text-muted">Point fort : <strong className="text-ink">{best.label}</strong> · À travailler : <strong className="text-ink">{worst.label}</strong></p>
            )}
            <Bars items={p.categories.map((c) => ({ label: c.label, value: c.average, hint: `${c.count} q.` }))} />
          </section>

          <section className="card space-y-3 p-6" aria-labelledby="historique">
            <h2 id="historique" className="text-xl font-bold">Historique</h2>
            <ul className="divide-y divide-line">
              {(days.data?.days ?? []).slice(0, 14).map((d) => (
                <li key={d.date}>
                  <Link to={`/profil/${d.date}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-accent">
                    <span>{capitalize(formatDay(d.date))}</span>
                    <span className="flex items-center gap-3">
                      <span className="flex gap-0.5" aria-hidden="true">
                        {d.answers.map((a) => <span key={a.position} className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_HEX[scoreColor(a.score)] }} />)}
                      </span>
                      <strong className="w-12 text-right">{d.score_total}</strong>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="card space-y-3 p-6" aria-labelledby="revue">
            <h2 id="revue" className="text-xl font-bold">Revue des questions</h2>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="f-cat" className="label">Catégorie</label>
                <select id="f-cat" className="input py-2 text-base" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                  <option value="all">Toutes</option>
                  {p.categories.map((c) => <option key={c.category} value={c.category}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="f-score" className="label">Score</label>
                <select id="f-score" className="input py-2 text-base" value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)}>
                  <option value="all">Tous</option>
                  <option value="bad">Erreurs (moins de 40)</option>
                  <option value="mid">Presque (40 à 79)</option>
                  <option value="good">Réussies (80 et plus)</option>
                </select>
              </div>
            </div>
            <p className="text-sm text-muted">{review.length} question{review.length > 1 ? "s" : ""}</p>
            <ul className="space-y-2">
              {review.slice(0, shown).map((a) => (
                <li key={`${a.date}-${a.position}`} className="rounded-2xl border border-line p-3 text-sm">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>{formatDay(a.date, "short")} · {catLabels.get(a.category) ?? a.category}</span>
                    <strong style={{ color: COLOR_HEX[scoreColor(a.score)] }}>{a.score}/100</strong>
                  </div>
                  <p className="font-semibold">{a.prompt}</p>
                  <p className="mt-1"><span className="text-muted">Toi : </span>{formatAnswer(a.user_answer, a.type, a.unit)} · <span className="text-muted">Réponse : </span>{formatAnswer(a.correct_answer, a.type, a.unit)}</p>
                </li>
              ))}
            </ul>
            {review.length > shown && <button className="btn-ghost w-full" onClick={() => setShown(shown + 20)}>Voir plus</button>}
          </section>
        </>
      )}

      <section className="card space-y-3 p-6" aria-labelledby="compte">
        <h2 id="compte" className="text-xl font-bold">Compte</h2>
        {!p.is_anonymous && <button className="btn-ghost w-full" onClick={() => signOut(auth).then(() => { qc.clear(); navigate("/"); })}>Se déconnecter</button>}
        {confirmDelete ? (
          <div className="space-y-2 rounded-2xl bg-bad/10 p-4">
            <p className="text-sm">Toutes tes données (historique, statistiques, pseudo) seront supprimées définitivement.</p>
            <div className="flex gap-2">
              <button className="btn flex-1 bg-bad text-white" onClick={deleteAccount}>Supprimer définitivement</button>
              <button className="btn-ghost flex-1" onClick={() => setConfirmDelete(false)}>Annuler</button>
            </div>
          </div>
        ) : (
          <button className="text-sm text-bad underline-offset-4 hover:underline" onClick={() => setConfirmDelete(true)}>Supprimer mon compte et mes données</button>
        )}
      </section>
    </div>
  );
}
