import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AnswerInput } from "../components/AnswerInput";
import { CategoryTag, DifficultyDots } from "../components/CategoryTag";
import { Feedback } from "../components/Feedback";
import { Pearls } from "../components/Pearls";
import { QuestionImage } from "../components/QuestionImage";
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
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [feedback]);

  if (error) return <ErrorBox message={(error as Error).message} onRetry={() => refetch()} />;
  if (isLoading || !data) return <Loading label="Préparation du quiz du jour…" />;
  if (data.completed && !feedback) return <Navigate to={`/resultats/${data.date}`} replace />;

  const answered = data.answers.length;
  const index = feedback ? feedback.position : answered;
  const question = data.questions[index];
  const scores = data.answers.map((a) => a.score);

  if (answered === 0 && !introDone && !feedback) {
    return (
      <div className="card animate-rise space-y-5 p-6 text-center">
        <p className="text-5xl" aria-hidden="true">🧠</p>
        <h1 className="text-3xl font-extrabold">Avant de commencer</h1>
        <p className="text-lg">Réponds <strong>sans aide</strong> : pas de recherche, pas d'IA, pas de calculatrice.</p>
        <p className="text-muted">Pas de chrono non plus. Prends le temps de réfléchir : une réponse approchée rapporte déjà des points sur les estimations.</p>
        <button className="btn-primary w-full text-lg" onClick={() => setIntroDone(true)} data-testid="intro-go">C'est parti, sans aide</button>
      </div>
    );
  }

  const submit = async (answer: Answer) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.answer(data.date, question.id, answer);
      setFeedback(result);
      qc.setQueryData(["today", user?.uid], {
        ...data,
        answers: [...data.answers, result],
        completed: result.completed,
        score_total: result.score_total,
        streak: result.streak,
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
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm font-semibold text-muted">
          <span data-testid="progress">Question {index + 1}/10</span>
          <DifficultyDots level={question.difficulty} />
        </div>
        <Pearls scores={feedback ? [...scores] : scores} current={feedback ? undefined : index} />
      </div>

      <article className="card space-y-5 p-5 sm:p-6" aria-labelledby="question-prompt">
        <CategoryTag label={question.category_label} pillar={question.pillar} />
        <h1 id="question-prompt" className="text-2xl font-bold leading-snug" data-testid="question-prompt">{question.prompt}</h1>
        {question.image_url && <QuestionImage src={question.image_url} alt={question.image_alt} credit={question.image_credit} />}
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
