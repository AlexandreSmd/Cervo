// Déroulé du quiz : mémorisation éventuelle, chrono, réponse, verdict, question suivante.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
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
      <p className="font-display text-2xl font-extrabold">Mémorise !</p>
      {items.length > 0 && (
        <div className={short ? "flex flex-wrap justify-center gap-2" : "grid grid-cols-2 gap-2"}>
          {items.map((it, i) => (
            <span
              key={i}
              className={`rounded-xl border-2 border-ink bg-card font-display font-extrabold ${short ? "min-w-[52px] px-3 py-3 text-4xl" : "px-3 py-3 text-xl"}`}
            >
              {it}
            </span>
          ))}
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, left / seconds) * 100}%` }} />
      </div>
      <p className="font-display text-4xl font-extrabold tabular-nums">{Math.max(0, Math.ceil(left))}</p>
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
  const [startError, setStartError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [expired, setExpired] = useState(false);

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
    setExpired(false);
    setSubmitError(null);
  }, [key]);

  // Le chrono démarre quand la question est vraiment à l'écran : après la mémorisation et une fois
  // ses photos chargées. Le serveur enregistre l'heure de départ (recharger ne la relance pas) ;
  // l'appel est idempotent et renvoie toujours une heure serveur fraîche pour caler le compte à rebours.
  useEffect(() => {
    if (!data || !question || feedback || data.completed || needsMemorize || started?.key === key) return;
    let cancelled = false;
    setStartError(null);
    (async () => {
      await preloadImages(question.images.map((i) => i.url));
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        try {
          const r = await api.startQuestion(data.date, question.id);
          if (!cancelled) setStarted({ key, at: Date.parse(r.started_at) + (Date.now() - Date.parse(r.server_time)) });
          return;
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            refetch(); // la question a changé côté serveur (déjà répondue, remplacée…)
            return;
          }
          await wait(700 * (attempt + 1));
        }
      }
      if (!cancelled) setStartError("Connexion impossible pour lancer la question.");
    })();
    return () => {
      cancelled = true;
    };
    // `data` change à chaque indice de devinette : la clé suffit à savoir s'il faut (re)lancer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, feedback, needsMemorize, started, retry, data?.completed]);

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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-ink/15 bg-card text-lg font-bold"
          aria-label="Quitter (ta progression est gardée)"
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

      <article className="card-strong space-y-5 p-5" aria-labelledby="question-prompt">
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
      {index === 0 && !feedback && (
        <p className="text-center text-xs text-muted">🧠 Sans aide · 10 types de questions, un chrono adapté à chacune</p>
      )}
    </div>
  );
}
