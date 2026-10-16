// Profil, en onglets : Progrès (moyenne, série, courbe, forme du cerveau, défis), Classement du mois,
// Historique (calendrier, toutes mes questions) et Compte.
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "firebase/auth";
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Bars, Heatmap, LineChart } from "../components/Charts";
import { LeaderboardList, MyRank } from "../components/Leaderboard";
import { ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import { auth } from "../lib/firebase";
import { COLOR_HEX, formatAnswer, formatDay, scoreColor } from "../lib/format";
import { useDays, useLeaderboard, useProfile, useToday } from "../lib/hooks";
import { kindInfo } from "../lib/kinds";
import { KindIcon } from "../components/KindIcon";

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-4">
      <div className="font-display text-3xl font-extrabold">{value}</div>
      <div className="text-xs font-semibold text-muted">{label}</div>
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
      <button
        className="flex items-center gap-2 text-left"
        onClick={() => {
          setValue(current);
          setEditing(true);
        }}
        aria-label="Modifier le pseudo"
      >
        <h1 className="text-3xl font-extrabold" data-testid="username">
          {current}
        </h1>
        <span className="text-muted" aria-hidden="true">
          ✎
        </span>
      </button>
    );
  }
  return (
    <form onSubmit={save} className="space-y-1">
      <div className="flex gap-2">
        <input
          className="input py-2"
          aria-label="Pseudo"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z0-9À-ÿ_.\-]+"
          required
          autoFocus
        />
        <button className="btn-dark btn-sm" type="submit">
          OK
        </button>
      </div>
      {error && (
        <p className="text-sm text-bad" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

const TABS = [
  ["progres", "Progrès"],
  ["classement", "Classement"],
  ["historique", "Historique"],
  ["compte", "Compte"],
] as const;
type Tab = (typeof TABS)[number][0];

const FILTERS = [
  ["all", "Toutes"],
  ["missed", "Ratées"],
  ["good", "Réussies"],
] as const;

export function Profile() {
  const { data: p, isLoading, error, refetch } = useProfile();
  const days = useDays();
  const today = useToday();
  const ranking = useLeaderboard();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.some(([key]) => key === params.get("onglet")) ? (params.get("onglet") as Tab) : "progres";
  const openTab = (key: Tab) => setParams(key === "progres" ? {} : { onglet: key }, { replace: true });
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("all");
  const [category, setCategory] = useState("all");
  const [shown, setShown] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const review = useMemo(() => {
    const all = (days.data?.days ?? []).flatMap((d) => d.answers.map((a) => ({ ...a, date: d.date })));
    return all.filter(
      (a) => (category === "all" || a.category === category) && (filter === "all" || (filter === "missed" ? a.score < 50 : a.score >= 50)),
    );
  }, [days.data, filter, category]);

  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;
  if (isLoading || !p) return <Loading />;
  const catLabels = new Map(p.categories.map((c) => [c.category, c.label]));

  const leave = async (fn: () => Promise<unknown>) => {
    setLeaving(true);
    setLeaveError(null);
    try {
      await fn();
      await signOut(auth);
      qc.clear();
      navigate("/");
    } catch (err) {
      setLeaveError((err as Error).message);
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <header className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent font-display text-2xl font-extrabold text-white">
          {p.username.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <Username current={p.username} />
          <p className="truncate text-sm text-muted">{p.is_anonymous ? "Invité" : p.email}</p>
        </div>
      </header>

      {today.data && !today.data.completed && (
        // Le quiz du jour n'est pas fini : c'est la seule chose à faire, on la met en premier.
        <Link to="/jouer" className="btn-primary w-full text-lg" data-testid="profile-play">
          {today.data.answers.length ? `Reprendre le quiz · ${today.data.answers.length + 1}/10` : "Jouer le quiz du jour"}
        </Link>
      )}

      {p.is_anonymous && (
        <Link to="/connexion" className="card flex items-center justify-between p-5" data-testid="create-account">
          <span>
            <span className="block font-bold">Sauvegarder ma progression</span>
            <span className="text-sm text-muted">Créer un compte avec ton e-mail</span>
          </span>
          <span className="text-2xl text-accent" aria-hidden="true">
            →
          </span>
        </Link>
      )}

      <div className="flex gap-1 rounded-xl bg-ink/5 p-1" role="tablist" aria-label="Sections du profil">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            id={`onglet-${key}`}
            aria-selected={tab === key}
            aria-controls={`panneau-${key}`}
            onClick={() => openTab(key)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold ${tab === key ? "bg-ink text-bg" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panneau-${tab}`} aria-labelledby={`onglet-${tab}`} className="space-y-4">
        {tab === "progres" && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Tile label="moyenne" value={p.average ?? "-"} />
              <Tile label="série" value={`🔥${p.current_streak}`} />
              <Tile label="jours" value={p.days_played} />
            </div>

            {p.days_played === 0 ? (
              <Link to="/jouer" className="btn-primary w-full">
                Jouer le quiz du jour
              </Link>
            ) : (
              <>
                <section className="card space-y-3 p-5">
                  <h2 className="text-lg font-bold">30 jours</h2>
                  <LineChart data={p.last_30_days} />
                </section>

                <section className="card space-y-3 p-5">
                  <h2 className="text-lg font-bold">Forme du cerveau</h2>
                  <Bars items={p.pillars.map((x) => ({ label: x.label, value: x.average }))} />
                </section>

                <section className="card space-y-3 p-5" data-testid="kind-skills">
                  <h2 className="text-lg font-bold">Tes 10 défis</h2>
                  <Bars
                    items={p.categories.map((c) => ({
                      label: c.label,
                      icon: (
                        <span style={{ color: kindInfo(c.category).color }}>
                          <KindIcon kind={c.category} className="h-4 w-4" />
                        </span>
                      ),
                      value: c.average,
                      hint: c.count ? `${c.count} rép.` : "à jouer",
                    }))}
                  />
                </section>
              </>
            )}
          </>
        )}

        {tab === "classement" &&
          (ranking.data ? (
            <>
              <MyRank data={ranking.data} />
              <LeaderboardList data={ranking.data} />
            </>
          ) : ranking.error ? (
            <ErrorBox message={(ranking.error as Error).message} onRetry={() => ranking.refetch()} />
          ) : (
            <Loading label="Chargement du classement…" />
          ))}

        {tab === "historique" &&
          (p.days_played === 0 ? (
            <Link to="/jouer" className="btn-primary w-full">
              Jouer le quiz du jour
            </Link>
          ) : (
            <>
              <section className="card space-y-3 p-5">
                <h2 className="text-lg font-bold">Calendrier</h2>
                <Heatmap days={(days.data?.days ?? []).map((d) => ({ date: d.date, score: d.score_total }))} today={p.today} />
              </section>

              <section className="card space-y-3 p-5" aria-labelledby="mes-questions">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="mes-questions" className="text-lg font-bold">
                    Mes questions
                  </h2>
                  <select
                    className="rounded-lg border-2 border-ink/15 bg-card px-3 py-1.5 text-base font-semibold"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    aria-label="Type de question"
                  >
                    <option value="all">Tous les types</option>
                    {p.categories.map((c) => (
                      <option key={c.category} value={c.category}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-1 rounded-xl bg-ink/5 p-1" role="tablist">
                  {FILTERS.map(([key, label]) => (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={filter === key}
                      onClick={() => setFilter(key)}
                      className={`flex-1 rounded-lg py-2 text-sm font-semibold ${filter === key ? "bg-ink text-bg" : "text-muted"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <ul className="-mx-5 divide-y divide-line border-t border-line">
                  {review.slice(0, shown).map((a) => (
                    <li key={`${a.date}-${a.position}`} className="flex gap-3 px-5 py-4">
                      <span
                        className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: COLOR_HEX[scoreColor(a.score)] }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{a.prompt}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          <span className="text-good">✓ {formatAnswer(a.correct_answer, a.type, a.unit)}</span>
                          <span className="mx-1.5">·</span>toi : {formatAnswer(a.user_answer, a.type, a.unit)}
                        </p>
                        <p className="text-xs text-muted">
                          {formatDay(a.date, "short")} · {catLabels.get(a.category) ?? kindInfo(a.category).label}
                        </p>
                      </div>
                      <span className="w-10 shrink-0 text-right font-display font-extrabold tabular-nums">{a.score}</span>
                    </li>
                  ))}
                  {review.length === 0 && <li className="px-5 py-6 text-center text-sm text-muted">Rien ici pour l'instant</li>}
                </ul>
                {review.length > shown && (
                  <button className="btn-ghost w-full" onClick={() => setShown(shown + 20)}>
                    Voir plus
                  </button>
                )}
              </section>
            </>
          ))}

        {tab === "compte" && (
          <section className="card divide-y divide-line overflow-hidden">
            {!p.is_anonymous && (
              <button className="w-full px-5 py-4 text-left font-semibold" onClick={() => leave(async () => undefined)}>
                Se déconnecter
              </button>
            )}
            {p.is_admin && (
              <Link to="/admin" className="block px-5 py-4 font-semibold text-accent">
                Espace fondateur
              </Link>
            )}
            <Link to="/?intro" className="block px-5 py-4 font-semibold" data-testid="replay-intro">
              Revoir la présentation
            </Link>
            <Link to="/confidentialite" className="block px-5 py-4 font-semibold">
              Confidentialité
            </Link>
            {confirmDelete ? (
              <div className="flex gap-2 p-4">
                <button className="btn btn-sm flex-1 bg-bad text-white" disabled={leaving} onClick={() => leave(api.deleteAccount)}>
                  {leaving ? "Suppression…" : "Tout supprimer"}
                </button>
                <button className="btn-ghost btn-sm flex-1" onClick={() => setConfirmDelete(false)}>
                  Annuler
                </button>
              </div>
            ) : (
              <button className="w-full px-5 py-4 text-left font-semibold text-bad" onClick={() => setConfirmDelete(true)}>
                Supprimer mes données
              </button>
            )}
            {leaveError && (
              <p className="px-5 py-3 text-sm text-bad" role="alert">
                {leaveError}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
