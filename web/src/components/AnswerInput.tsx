// Zone de réponse : une saisie propre à chaque mécanique (voir components/answers/).
import { useEffect, useRef, useState } from "react";
import { parseNumberInput } from "../lib/format";
import type { Answer, PublicQuestion } from "../lib/types";
import { ChoiceInput } from "./answers/ChoiceInput";
import { DictationInput } from "./answers/DictationInput";
import { OrderInput } from "./answers/OrderInput";
import { PercentInput } from "./answers/PercentInput";
import { RecallInput, recallTokens } from "./answers/RecallInput";
import { RiddleInput } from "./answers/RiddleInput";
import { SizeInput } from "./answers/SizeInput";
import { SliderInput } from "./answers/SliderInput";

type Q = Pick<
  PublicQuestion,
  "id" | "type" | "choices" | "unit" | "items" | "size" | "slider" | "speech" | "clues" | "clue_total" | "recall"
>;

interface Props {
  question: Q;
  disabled: boolean;
  /** Le chrono est fini : on envoie ce qui a été saisi (ou rien). */
  expired?: boolean;
  /** Envoie la réponse ; `false` si elle n'a pas été enregistrée (le joueur peut renvoyer). */
  onSubmit: (answer: Answer | null) => Promise<boolean> | void;
  /** Réponse en cours d'envoi (le bouton l'indique). */
  submitting?: boolean;
  /** Devinette : demande l'indice suivant au serveur. */
  onClue?: () => Promise<void>;
}

/** Message quand on valide sans réponse exploitable. */
const MISSING: Partial<Record<Q["type"], string>> = {
  numeric: "Un nombre, par exemple 1 250 ou 3,5",
  short_text: "Écris ta réponse",
  riddle: "Écris ta réponse",
  dictation: "Écris la dictée",
  recall: "Écris ce dont tu te souviens",
  order: "Touche les éléments dans l'ordre",
  percent: "Déplace le curseur",
};

/** Le geste à faire, dit simplement, juste au-dessus de la zone de réponse. */
function gesture(question: Q): string {
  switch (question.type) {
    case "binary":
      return "Touche Vrai ou Faux";
    case "mcq":
      return "Touche la bonne réponse";
    case "size":
      return `Glisse pour régler la taille : ${question.size?.target.label ?? "l'objet"}`;
    case "percent":
      return "Glisse sur ton estimation, puis valide";
    case "numeric":
      return question.slider ? "Glisse sur ton estimation, puis valide" : "Tape un nombre, puis valide";
    case "order":
      return "Touche les éléments dans l'ordre";
    case "dictation":
      return "Écoute, écris, puis valide";
    case "recall":
      return "Écris tout ce dont tu te souviens";
    case "riddle":
      return "Tape ta réponse. Bloqué ? Prends un indice";
    default:
      return "Tape ta réponse, puis valide";
  }
}

/** Saisie adaptée à la mécanique de réponse de la question. */
export function AnswerInput({ question, disabled, expired = false, onSubmit, submitting = false, onClue }: Props) {
  // Saisie au clavier (texte, nombre, dictée, rappel, devinette) et valeur choisie (le reste).
  const [raw, setRaw] = useState("");
  const [value, setValue] = useState<Answer | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [ratio, setRatio] = useState(1);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sent = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setRaw("");
    setValue(null);
    setPicked([]);
    setError(null);
    setRatio(question.size ? Math.sqrt(question.size.min * question.size.max) : 1);
    sent.current = false;
    // Volontaire : on ne réinitialise la saisie qu'au changement de question.
  }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Le clavier s'ouvre tout seul pour les réponses tapées (pas pour la dictée : il faut d'abord écouter).
    if (!disabled && question.type !== "dictation") inputRef.current?.focus();
  }, [disabled, question.id, question.type]);

  /** Réponse actuelle, ou null si rien d'exploitable. */
  const current = (): Answer | null => {
    switch (question.type) {
      case "numeric":
        return question.slider ? value : parseNumberInput(raw);
      case "short_text":
      case "dictation":
      case "riddle":
        return raw.trim() || null;
      case "recall":
        return recallTokens(raw, !!question.recall?.single_chars).length ? raw.trim() : null;
      case "order": {
        const items = question.items ?? [];
        if (!picked.length) return null;
        return [...picked, ...items.filter((i) => !picked.includes(i))];
      }
      case "size":
        return Math.round(ratio * 100) / 100;
      default:
        return value;
    }
  };

  const send = (answer: Answer | null) => {
    if (sent.current) return;
    sent.current = true;
    // Échec d'envoi (réseau…) : on peut renvoyer, au lieu de rester bloqué sur la question.
    Promise.resolve(onSubmit(answer)).then((ok) => {
      if (ok === false) sent.current = false;
    });
  };

  useEffect(() => {
    if (expired && !disabled) send(current());
    // Volontaire : on n'envoie qu'une fois, au moment où le chrono expire (la saisie lue est la dernière).
  }, [expired]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const answer = current();
    if (answer === null) {
      setError(MISSING[question.type] ?? "Choisis une réponse");
      return;
    }
    if (question.type === "order" && picked.length < (question.items?.length ?? 0) - 1) {
      setError("Touche tous les éléments dans l'ordre");
      return;
    }
    send(answer);
  };

  const typing = (v: string) => {
    setRaw(v);
    setError(null);
  };
  const choose = (v: Answer) => {
    setValue(v);
    setError(null);
  };
  // Vrai/Faux et QCM : toucher un choix, c'est répondre (pas de « Valider » à chercher).
  const oneTap = question.type === "binary" || question.type === "mcq";
  const pick = (v: Answer) => {
    if (sent.current) return;
    choose(v);
    send(v);
  };
  const askClue = async () => {
    if (!onClue) return;
    setAsking(true);
    try {
      await onClue();
    } finally {
      setAsking(false);
      inputRef.current?.focus();
    }
  };

  // Le bouton ne s'allume que quand la réponse est complète : on voit tout de suite s'il manque quelque chose.
  const ready = current() !== null && (question.type !== "order" || picked.length >= (question.items?.length ?? 0) - 1);

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Ta réponse">
      <p className="text-sm font-semibold text-muted" data-testid="gesture">
        {gesture(question)}
      </p>
      {question.type === "binary" && (
        <ChoiceInput
          binary
          options={[
            { label: "Vrai", value: true },
            { label: "Faux", value: false },
          ]}
          value={value}
          disabled={disabled}
          busy={submitting}
          onChange={pick}
        />
      )}
      {question.type === "mcq" && (
        <ChoiceInput
          binary={false}
          options={(question.choices ?? []).map((c) => ({ label: c, value: c }))}
          value={value}
          disabled={disabled}
          busy={submitting}
          onChange={pick}
        />
      )}
      {question.type === "order" && (
        <OrderInput
          items={question.items ?? []}
          picked={picked}
          disabled={disabled}
          onChange={(p) => {
            setPicked(p);
            setError(null);
          }}
        />
      )}
      {question.type === "size" && question.size && (
        <SizeInput config={question.size} ratio={ratio} disabled={disabled} onChange={setRatio} />
      )}
      {question.type === "percent" && <PercentInput value={value as number | null} disabled={disabled} onChange={choose} />}
      {question.type === "numeric" && question.slider && (
        <SliderInput {...question.slider} unit={question.unit} value={value as number | null} disabled={disabled} onChange={choose} />
      )}
      {question.type === "dictation" && (
        <DictationInput speech={question.speech} value={raw} disabled={disabled} onChange={typing} inputRef={areaRef} />
      )}
      {question.type === "recall" && question.recall && (
        <RecallInput recall={question.recall} value={raw} disabled={disabled} onChange={typing} inputRef={inputRef} />
      )}
      {question.type === "riddle" && (
        <RiddleInput
          clues={question.clues ?? []}
          total={question.clue_total ?? question.clues?.length ?? 0}
          value={raw}
          disabled={disabled}
          asking={asking}
          onChange={typing}
          onClue={onClue ? askClue : undefined}
          inputRef={inputRef}
        />
      )}
      {((question.type === "numeric" && !question.slider) || question.type === "short_text") && (
        <div className="relative">
          <label htmlFor="answer" className="sr-only">
            {question.type === "numeric" ? "Ton estimation" : "Ta réponse"}
          </label>
          <input
            id="answer"
            ref={inputRef}
            className="input min-h-[56px] pr-20 text-xl font-semibold"
            inputMode={question.type === "numeric" ? "decimal" : "text"}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={raw}
            disabled={disabled}
            onChange={(e) => typing(e.target.value)}
            placeholder={question.type === "numeric" ? "Ton estimation" : "Ta réponse"}
          />
          {question.unit && question.type === "numeric" && (
            <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 font-semibold text-muted">{question.unit}</span>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm font-semibold text-bad" role="alert">
          {error}
        </p>
      )}
      {oneTap ? (
        submitting && (
          <p className="text-center text-sm font-semibold text-muted" aria-live="polite">
            Vérification…
          </p>
        )
      ) : (
        // Toujours sous le pouce : le bouton reste collé en bas de l'écran, même avec un long énoncé.
        <div className="sticky bottom-0 -mx-5 bg-card px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
          <button
            type="submit"
            className={`btn-dark w-full text-lg ${submitting ? "btn-busy" : ""}`}
            disabled={disabled || (!ready && !submitting)}
            aria-busy={submitting}
            data-testid="submit"
          >
            {submitting ? "Vérification…" : "Valider"}
          </button>
        </div>
      )}
    </form>
  );
}
