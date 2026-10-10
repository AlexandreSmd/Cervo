import { useEffect, useRef, useState } from "react";
import { parseNumberInput } from "../lib/format";
import type { Answer, PublicQuestion } from "../lib/types";

interface Props {
  question: Pick<PublicQuestion, "id" | "type" | "choices" | "unit">;
  disabled: boolean;
  onSubmit: (answer: Answer) => void;
}

/** Saisie adaptée au format de réponse. */
export function AnswerInput({ question, disabled, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [choice, setChoice] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue("");
    setChoice(null);
    setError(null);
    if (!disabled) inputRef.current?.focus();
  }, [question.id, disabled]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (question.type === "numeric") {
      const n = parseNumberInput(value);
      if (n === null) return setError("Un nombre, par exemple 1 250 ou 3,5");
      return onSubmit(n);
    }
    if (question.type === "short_text") {
      if (!value.trim()) return setError("Écris ta réponse");
      return onSubmit(value.trim());
    }
    if (choice === null) return setError("Choisis une réponse");
    onSubmit(choice);
  };

  const options: { label: string; value: Answer }[] =
    question.type === "binary"
      ? [{ label: "Vrai", value: true }, { label: "Faux", value: false }]
      : (question.choices ?? []).map((c) => ({ label: c, value: c }));

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Ta réponse">
      {(question.type === "binary" || question.type === "mcq") && (
        <div role="radiogroup" aria-label="Choix" className={question.type === "binary" ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
          {options.map((opt) => {
            const selected = choice === opt.value;
            return (
              <button key={String(opt.value)} type="button" role="radio" aria-checked={selected} disabled={disabled}
                onClick={() => { setChoice(opt.value); setError(null); }}
                className={`min-h-[56px] rounded-2xl px-5 text-left text-base font-semibold transition ${question.type === "binary" ? "text-center text-lg" : ""} ${
                  selected ? "bg-accent text-white" : "bg-ink/5 hover:bg-ink/10"}`}>
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
      {(question.type === "numeric" || question.type === "short_text") && (
        <div className="relative">
          <label htmlFor="answer" className="sr-only">{question.type === "numeric" ? "Ton estimation" : "Ta réponse"}</label>
          <input id="answer" ref={inputRef} className="input min-h-[56px] pr-16 text-xl font-semibold"
            inputMode={question.type === "numeric" ? "decimal" : "text"} autoComplete="off" autoCapitalize="off" spellCheck={false}
            value={value} disabled={disabled} onChange={(e) => { setValue(e.target.value); setError(null); }}
            placeholder={question.type === "numeric" ? "Ton estimation" : "Ta réponse"} />
          {question.unit && question.type === "numeric" && (
            <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 font-semibold text-muted">{question.unit}</span>
          )}
        </div>
      )}
      {error && <p className="text-sm font-semibold text-bad" role="alert">{error}</p>}
      <button type="submit" className="btn-dark w-full text-lg" disabled={disabled}>Valider</button>
    </form>
  );
}
