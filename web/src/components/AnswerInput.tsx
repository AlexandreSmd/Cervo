import { useEffect, useRef, useState } from "react";
import { parseNumberInput } from "../lib/format";
import type { Answer, PublicQuestion } from "../lib/types";

interface Props {
  question: PublicQuestion;
  disabled: boolean;
  onSubmit: (answer: Answer) => void;
}

/** Champ de réponse adapté au type de question. */
export function AnswerInput({ question, disabled, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [choice, setChoice] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue("");
    setChoice(null);
    setError(null);
    inputRef.current?.focus();
  }, [question.id]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (question.type === "numeric") {
      const n = parseNumberInput(value);
      if (n === null) return setError("Entre un nombre, par exemple 1 250 ou 3,5.");
      return onSubmit(n);
    }
    if (question.type === "short_text") {
      if (!value.trim()) return setError("Écris ta réponse avant de valider.");
      return onSubmit(value.trim());
    }
    if (choice === null) return setError("Choisis une réponse.");
    onSubmit(choice);
  };

  const options: { label: string; value: Answer }[] =
    question.type === "binary"
      ? [{ label: "Vrai", value: true }, { label: "Faux", value: false }]
      : (question.choices ?? []).map((c) => ({ label: c, value: c }));

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Ta réponse">
      {(question.type === "binary" || question.type === "mcq") && (
        <div role="radiogroup" aria-label="Choix de réponse" className={question.type === "binary" ? "grid grid-cols-2 gap-3" : "grid gap-3"}>
          {options.map((opt) => {
            const selected = choice === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => { setChoice(opt.value); setError(null); }}
                className={`btn min-h-[56px] justify-start border-2 text-left text-base ${
                  selected ? "border-accent bg-accent/10 text-ink" : "border-line bg-card hover:border-accent/50"
                } ${question.type === "binary" ? "justify-center text-lg" : ""}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
      {(question.type === "numeric" || question.type === "short_text") && (
        <div>
          <label htmlFor="answer" className="label">
            {question.type === "numeric" ? `Ton estimation${question.unit ? ` (en ${question.unit})` : ""}` : "Ta réponse"}
          </label>
          <div className="relative">
            <input
              id="answer"
              ref={inputRef}
              className="input pr-16"
              inputMode={question.type === "numeric" ? "decimal" : "text"}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              value={value}
              disabled={disabled}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              placeholder={question.type === "numeric" ? "Un nombre" : "Écris ta réponse"}
            />
            {question.unit && question.type === "numeric" && (
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">{question.unit}</span>
            )}
          </div>
        </div>
      )}
      {error && <p className="text-sm font-semibold text-bad" role="alert">{error}</p>}
      <button type="submit" className="btn-primary w-full text-lg" disabled={disabled}>
        Valider
      </button>
    </form>
  );
}
