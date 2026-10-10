import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AnswerInput } from "../components/AnswerInput";
import { Feedback } from "../components/Feedback";
import { Pearls } from "../components/Pearls";
import { QuestionHeader } from "../components/QuestionCard";
import { ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToday } from "../lib/hooks";
import type { Answer, SubmitResult } from "../lib/types";

export function Play() {
  const { data, isLoading, error, refetch } = useToday();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<SubmitResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [feedback]);

  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Loading />;
  if (data.completed && !feedback) return <Navigate to={`/resultats/${data.date}`} replace />;

  const index = feedback ? feedback.position : data.answers.length;
  const question = data.questions[index];
  const scores = data.answers.map((a) => a.score);

  const submit = async (answer: Answer) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.answer(data.date, question.id, answer);
      setFeedback(result);
      qc.setQueryData(["today", user?.uid], {
        ...data, answers: [...data.answers, result], completed: result.completed, score_total: result.score_total, streak: result.streak,
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
    <div className="space-y-5 pt-2">
      <div className="flex items-center gap-3">
        <Link to="/" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/5 text-lg" aria-label="Quitter (ta progression est gardée)">×</Link>
        <div className="flex-1"><Pearls scores={scores} current={feedback ? undefined : index} size="sm" /></div>
        <span className="w-10 text-right text-sm font-bold" data-testid="progress">{index + 1}/10</span>
      </div>
      {index === 0 && !feedback && <p className="chip bg-accent/10 text-accent">🧠 Sans aide : pas de recherche, pas d'IA</p>}
      <article className="card space-y-5 p-5" aria-labelledby="question-prompt">
        <QuestionHeader question={question} />
        {feedback ? (
          <Feedback question={question} result={feedback} onNext={next} isLast={feedback.completed} />
        ) : (
          <AnswerInput question={question} disabled={submitting} onSubmit={submit} />
        )}
        {submitError && <p className="text-sm font-semibold text-bad" role="alert">{submitError}</p>}
      </article>
    </div>
  );
}
