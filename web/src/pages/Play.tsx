// Déroulé du quiz : mémorisation éventuelle, chrono, réponse, verdict, question suivante.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AnswerInput } from "../components/AnswerInput";
import { Feedback } from "../components/Feedback";
import { Pearls } from "../components/Pearls";
import { QuestionHeader } from "../components/QuestionCard";
import { ErrorBox, Loading } from "../components/States";
import { Timer } from "../components/Timer";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToday } from "../lib/hooks";
import type { Answer, PublicQuestion, SubmitResult } from "../lib/types";

/** Charge les photos avant de lancer le chrono (au plus `timeout` ms : un réseau lent ne bloque pas le jeu). */
function preloadImages(urls: string[], timeout = 2500): Promise<void> {
  if (!urls.length) return Promise.resolve();
  const loads = urls.map(
    (url) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = url;
      }),
  );
  return Promise.race([Promise.all(loads).then(() => undefined), new Promise<void>((r) => window.setTimeout(r, timeout))]);
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** Petite vibration selon le verdict (Android ; ignorée ailleurs). */
function buzz(score: number) {
  try {
    navigator.vibrate?.(score >= 80 ? 25 : [30, 60, 30]);
  } catch {
    // pas de vibreur : rien à faire
  }
}

/** Phase de mémorisation : on montre, on compte, puis on cache. */
function Memorize({ question, onDone }: { question: PublicQuestion; onDone: () => void }) {
  const seconds = question.memorize?.seconds ?? 5;
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const l = seconds - (Date.now() - start) / 1000;
      setLeft(l);
      if (l <= 0) {
        window.clearInterval(id);
        onDone();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [seconds, onDone]);
  const items = question.memorize?.items ?? [];
  const short = items.every((it) => it.length <= 2);
  return (
    <div className="space-y-5 text-center" data-testid="memorize">
      <div>
        <p className="font-display text-2xl font-extrabold">Mémorise !</p>
        <p className="text-sm font-semibold text-muted">
          {items.length > 1
            ? `Retiens ces ${items.length} éléments, dans l'ordre. Ils vont disparaître.`
            : "Regarde bien, ça va disparaître."}
        </p>
      </div>
      {items.length > 0 &&
        // Toujours une seule ligne (chiffres) ou une seule colonne numérotée (mots) : l'ordre se lit sans hésiter.
        (short ? (
          <ol className="flex gap-1.5" aria-label="À mémoriser, dans l'ordre">
            {items.map((it, i) => (
              <li
                key={i}
                className="flex aspect-[3/4] min-w-0 flex-1 items-center justify-center rounded-lg border-2 border-ink bg-card font-display text-3xl font-extrabold"
              >
                {it}
              </li>
            ))}
          </ol>
        ) : (
          <ol className="mx-auto max-w-[300px] space-y-1.5 text-left" aria-label="À mémoriser, dans l'ordre">
            {items.map((it, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg border-2 border-ink bg-card px-3 py-2">
                <span className="w-5 text-right font-display text-sm font-bold text-muted">{i + 1}</span>
                <span className="font-display text-lg font-extrabold">{it}</span>
              </li>
            ))}
          </ol>
        ))}
      <div className="h-2 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, left / seconds) * 100}%` }} />
      </div>
      <p className="font-display text-4xl font-extrabold tabular-nums">{Math.max(0, Math.ceil(left))}</p>
      {/* Déjà retenu ? On passe à la question sans attendre la fin du compte. */}
      <button type="button" className="btn-ghost w-full" onClick={onDone} data-testid="memorized">
        C'est bon, j'ai retenu →
      </button>
    </div>
  );
}

export function Play() {
  const today = useToday();
  const { isLoading, error, refetch } = today;
  // Le jeu n'utilise que des données fraîches (chrono, position) : jamais celles gardées sur l'appareil.
  const data = today.isPlaceholderData ? undefined : today.data;
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [memorized, setMemorized] = useState<string | null>(null);
  // Chrono de la question affichée, repéré par une clé date + position + question : un nouveau jour
  // (appli restée ouverte après minuit) ou une question remplacée repart de zéro.
  const [started, setStarted] = useState<{ key: string; at: number } | null>(null);
  // Question dont le départ est bien enregistré côté serveur.
  const [launched, setLaunched] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [expired, setExpired] = useState(false);
  const [quitting, setQuitting] = useState(false);
  // Lancement du chrono côté serveur, en cours ou fini : une réponse l'attend avant de partir.
  const starting = useRef<{ key: string; done: Promise<boolean> } | null>(null);

  const index = data ? (feedback ? feedback.position : data.answers.length) : 0;
  const question = data?.questions[index];
  const key = data && question ? `${data.date}:${index}:${question.id}` : "";
  const resumed = !!data?.current && data.current.position === index && data.current.question_id === question?.id;
  const needsMemorize = !!question?.memorize && memorized !== key && !resumed;

  // Nouveau jour pendant que l'appli était ouverte : on repart d'un écran propre.
  useEffect(() => {
    setFeedback(null);
    setSubmitError(null);
  }, [data?.date]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setQuitting(false);
    setExpired(false);
    setSubmitError(null);
  }, [key]);

  // Le chrono démarre quand la question est vraiment à l'écran : après la mémorisation et une fois
  // ses photos chargées. L'écran n'attend pas le serveur : le compte à rebours part tout de suite,
  // et l'heure de départ est enregistrée en parallèle (recharger ne la relance pas). Le serveur part
  // un peu plus tard que l'écran : c'est le joueur qui a le chrono le plus strict, jamais l'inverse.
  // Reprise après rechargement : on attend l'heure de départ déjà enregistrée.
  useEffect(() => {
    if (!data || !question || feedback || data.completed || needsMemorize || launched === key) return;
    let cancelled = false;
    setStartError(null);
    const done = (async () => {
      await preloadImages(question.images.map((i) => i.url));
      if (cancelled) return false;
      const shownAt = Date.now();
      // Une relance (réseau) garde le compte à rebours déjà affiché.
      if (!resumed) setStarted((s) => (s?.key === key ? s : { key, at: shownAt }));
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        try {
          const r = await api.startQuestion(data.date, question.id);
          if (cancelled) return true;
          if (resumed) setStarted({ key, at: Date.parse(r.started_at) + (Date.now() - Date.parse(r.server_time)) });
          setLaunched(key);
          return true;
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            refetch(); // la question a changé côté serveur (déjà répondue, remplacée…)
            return false;
          }
          await wait(700 * (attempt + 1));
        }
      }
      if (!cancelled) setStartError("Connexion impossible pour lancer la question.");
      return false;
    })();
    starting.current = { key, done };
    return () => {
      cancelled = true;
    };
    // `data` change à chaque indice de devinette : la clé suffit à savoir s'il faut (re)lancer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, feedback, needsMemorize, launched, retry, data?.completed]);

  // Pendant la correction, on charge déjà les photos de la question suivante.
  useEffect(() => {
    const nextQuestion = feedback && data ? data.questions[feedback.position + 1] : undefined;
    if (nextQuestion) preloadImages(nextQuestion.images.map((i) => i.url));
  }, [feedback, data]);

  const onExpire = useCallback(() => setExpired(true), []);
  const doneMemorizing = useCallback(() => setMemorized(key), [key]);

  /** Devinette : l'indice suivant vient du serveur, qui garde le compte (il fixe le score). */
  const askClue = useCallback(async () => {
    if (!data || !question) return;
    try {
      const { clues } = await api.clue(data.date, question.id);
      qc.setQueryData(["today", user?.uid], {
        ...data,
        questions: data.questions.map((q) => (q.id === question.id ? { ...q, clues } : q)),
      });
    } catch (err) {
      setSubmitError((err as Error).message);
    }
  }, [data, question, qc, user?.uid]);

  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;
  if (isLoading || !data || !question) return <Loading />;
  if (data.completed && !feedback) return <Navigate to={`/resultats/${data.date}`} replace />;

  const scores = data.answers.map((a) => a.score);
  const hideImages = !!question.memorize?.hide_images && !needsMemorize;
  const timerReady = started?.key === key;

  /** Envoie la réponse ; renvoie false si elle n'a pas pu être enregistrée (on peut alors réessayer). */
  const submit = async (answer: Answer | null): Promise<boolean> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Rare : on valide avant que le serveur ait fini d'enregistrer le départ du chrono.
      const launch = starting.current?.key === key ? starting.current.done : Promise.resolve(true);
      if (!(await launch)) {
        setRetry((n) => n + 1); // relance l'enregistrement du départ, puis on pourra renvoyer
        throw new Error("Connexion impossible.");
      }
      const result = await api.answer(data.date, question.id, answer);
      buzz(result.score);
      setFeedback(result);
      qc.setQueryData(["today", user?.uid], {
        ...data,
        current: null,
        answers: [...data.answers, result],
        completed: result.completed,
        score_total: result.score_total,
        streak: result.streak,
      });
      return true;
    } catch (err) {
      setSubmitError(`${(err as Error).message} Réessaie.`);
      refetch();
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // Quitter pendant un chrono : le temps continue de courir, on prévient avant.
  const clockRunning = timerReady && !feedback && question.time_limit !== null;
  const quit = (e: React.MouseEvent) => {
    if (!clockRunning) return;
    e.preventDefault();
    setQuitting(true);
  };

  const next = () => {
    if (feedback?.completed) {
      qc.invalidateQueries();
      navigate(`/resultats/${data.date}`);
      return;
    }
    setFeedback(null);
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center gap-3">
        <Link
          to="/"
          onClick={quit}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-ink/15 bg-card text-lg font-bold"
          aria-label="Quitter (ta progression est gardée)"
          data-testid="quit"
        >
          ×
        </Link>
        <div className="flex-1">
          <Pearls scores={scores} current={feedback ? undefined : index} size="sm" />
        </div>
        <span className="w-10 text-right text-sm font-bold" data-testid="progress">
          {index + 1}/10
        </span>
      </div>

      {quitting && (
        <div
          className="card-strong animate-rise space-y-3 p-5"
          role="alertdialog"
          aria-label="Quitter la question ?"
          data-testid="quit-confirm"
        >
          <p className="font-display text-lg font-extrabold">Le chrono continue sans toi</p>
          <p className="text-sm text-muted">Tes réponses sont gardées, mais si tu pars, cette question risque de compter 0.</p>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-dark" onClick={() => setQuitting(false)} autoFocus>
              Je reste
            </button>
            <Link to="/" className="btn-ghost">
              Quitter
            </Link>
          </div>
        </div>
      )}
      <article key={key} className="card-strong animate-slide-in space-y-5 p-5" aria-labelledby="question-prompt">
        {needsMemorize && !feedback ? (
          <>
            {question.memorize?.hide_images && <QuestionHeader question={{ ...question, prompt: "Regarde bien…" }} />}
            <Memorize question={question} onDone={doneMemorizing} />
          </>
        ) : (
          <>
            {!feedback &&
              (question.time_limit === null ? (
                <p className="flex h-7 items-center justify-center text-xs font-semibold text-muted" data-testid="no-timer">
                  Sans chrono · prends ton temps
                </p>
              ) : timerReady ? (
                <Timer key={key} startedAt={started!.at} limit={question.time_limit} onExpire={onExpire} paused={submitting} />
              ) : (
                <div className="h-7" />
              ))}
            <QuestionHeader question={hideImages ? { ...question, images: [] } : question} />
            {feedback ? (
              <Feedback question={question} result={feedback} onNext={next} isLast={feedback.completed} />
            ) : (
              <AnswerInput
                question={question}
                disabled={submitting || !timerReady}
                submitting={submitting}
                expired={expired}
                onSubmit={submit}
                onClue={question.type === "riddle" ? askClue : undefined}
              />
            )}
          </>
        )}
        {submitError && (
          <p className="text-sm font-semibold text-bad" role="alert">
            {submitError}
          </p>
        )}
        {startError && !feedback && (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-bad/10 p-3 text-sm" role="alert">
            <span className="font-semibold text-bad">{startError}</span>
            <button className="btn-ghost btn-sm bg-card" onClick={() => setRetry((n) => n + 1)}>
              Réessayer
            </button>
          </div>
        )}
      </article>
    </div>
  );
}
