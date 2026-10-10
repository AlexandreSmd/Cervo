import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AnswerInput } from "../components/AnswerInput";
import { Feedback } from "../components/Feedback";
import { Pearls } from "../components/Pearls";
import { QuestionHeader } from "../components/QuestionCard";
import { ErrorBox, Loading } from "../components/States";
import { Timer } from "../components/Timer";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToday } from "../lib/hooks";
import type { Answer, PublicQuestion, SubmitResult } from "../lib/types";

/** Phase de mémorisation : on montre, on compte, puis on cache. */
function Memorize({ question, onDone }: { question: PublicQuestion; onDone: () => void }) {
  const seconds = question.memorize?.seconds ?? 5;
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      const l = seconds - (Date.now() - start) / 1000;
      setLeft(l);
      if (l <= 0) { window.clearInterval(id); onDone(); }
    }, 100);
    return () => window.clearInterval(id);
  }, [seconds, onDone]);
  const items = question.memorize?.items ?? [];
  return (
    <div className="space-y-5 text-center" data-testid="memorize">
      <p className="font-display text-2xl font-extrabold">Mémorise !</p>
      {items.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {items.map((it, i) => <span key={i} className="rounded-2xl bg-accent/10 px-4 py-3 font-display text-2xl font-extrabold">{it}</span>)}
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(0, left / seconds) * 100}%` }} /></div>
      <p className="font-display text-4xl font-extrabold tabular-nums">{Math.max(0, Math.ceil(left))}</p>
    </div>
  );
}

export function Play() {
  const { data, isLoading, error, refetch } = useToday();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [memorized, setMemorized] = useState<number | null>(null);
  const [started, setStarted] = useState<{ position: number; at: number } | null>(null);
  const [expired, setExpired] = useState(false);

  const index = data ? (feedback ? feedback.position : data.answers.length) : 0;
  const question = data?.questions[index];
  const needsMemorize = !!question?.memorize && memorized !== index && data?.current?.position !== index;

  useEffect(() => { window.scrollTo({ top: 0 }); setExpired(false); }, [index, feedback]);

  // Démarre le chrono côté serveur dès que la question est visible (après la mémorisation).
  useEffect(() => {
    if (!data || !question || feedback || data.completed || needsMemorize || started?.position === index) return;
    const offset = Date.now() - Date.parse(data.server_time);
    if (data.current?.position === index) {
      setStarted({ position: index, at: Date.parse(data.current.started_at) + offset });
      return;
    }
    let cancelled = false;
    api.startQuestion(data.date, question.id)
      .then((r) => { if (!cancelled) setStarted({ position: index, at: Date.parse(r.started_at) + (Date.now() - Date.parse(r.server_time)) }); })
      .catch(() => { if (!cancelled) setStarted({ position: index, at: Date.now() }); });
    return () => { cancelled = true; };
  }, [data, question, index, feedback, needsMemorize, started]);

  const onExpire = useCallback(() => setExpired(true), []);
  const doneMemorizing = useCallback(() => setMemorized(index), [index]);

  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;
  if (isLoading || !data || !question) return <Loading />;
  if (data.completed && !feedback) return <Navigate to={`/resultats/${data.date}`} replace />;

  const scores = data.answers.map((a) => a.score);
  const hideImages = !!question.memorize?.hide_images && !needsMemorize;
  const timerReady = started?.position === index;

  const submit = async (answer: Answer | null) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.answer(data.date, question.id, answer);
      setFeedback(result);
      qc.setQueryData(["today", user?.uid], {
        ...data, current: null, answers: [...data.answers, result], completed: result.completed, score_total: result.score_total, streak: result.streak,
      });
    } catch (err) {
      setSubmitError((err as Error).message);
      refetch();
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
        <Link to="/" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-lg" aria-label="Quitter (ta progression est gardée)">×</Link>
        <div className="flex-1"><Pearls scores={scores} current={feedback ? undefined : index} size="sm" /></div>
        <span className="w-10 text-right text-sm font-bold" data-testid="progress">{index + 1}/10</span>
      </div>

      <article className="card space-y-5 p-5" aria-labelledby="question-prompt">
        {needsMemorize && !feedback ? (
          <>
            {question.memorize?.hide_images && <QuestionHeader question={{ ...question, prompt: "Regarde bien…" }} />}
            <Memorize question={question} onDone={doneMemorizing} />
          </>
        ) : (
          <>
            {!feedback && (timerReady
              ? <Timer startedAt={started!.at} limit={question.time_limit} onExpire={onExpire} paused={submitting} />
              : <div className="h-7" />)}
            <QuestionHeader question={hideImages ? { ...question, images: [] } : question} />
            {feedback ? (
              <Feedback question={question} result={feedback} onNext={next} isLast={feedback.completed} />
            ) : (
              <AnswerInput question={question} disabled={submitting || !timerReady} expired={expired} onSubmit={submit} />
            )}
          </>
        )}
        {submitError && <p className="text-sm font-semibold text-bad" role="alert">{submitError}</p>}
      </article>
      {index === 0 && !feedback && <p className="text-center text-xs text-muted">🧠 Sans aide · {question.time_limit} s par question</p>}
    </div>
  );
}
