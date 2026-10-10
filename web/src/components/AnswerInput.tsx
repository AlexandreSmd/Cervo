// Zone de réponse : une saisie par format (choix, nombre, curseur, texte, ordre, taille, dictée).
import { useEffect, useRef, useState } from "react";
import { formatNumber, parseNumberInput } from "../lib/format";
import type { Answer, PublicQuestion } from "../lib/types";

type Q = Pick<PublicQuestion, "id" | "type" | "choices" | "unit" | "items" | "size" | "slider" | "speech">;

interface Props {
  question: Q;
  disabled: boolean;
  /** Le chrono est fini : on envoie ce qui a été saisi (ou rien). */
  expired?: boolean;
  onSubmit: (answer: Answer | null) => void;
}

/** Saisie adaptée au format de réponse. */
export function AnswerInput({ question, disabled, expired = false, onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [choice, setChoice] = useState<Answer | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [ratio, setRatio] = useState(1);
  const [slide, setSlide] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sent = useRef(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue("");
    setChoice(null);
    setPicked([]);
    setError(null);
    setSlide(null);
    setRatio(question.size ? Math.sqrt(question.size.min * question.size.max) : 1);
    sent.current = false;
    if (!disabled) inputRef.current?.focus();
    // Volontaire : on ne réinitialise la saisie qu'au changement de question.
  }, [question.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Réponse actuelle, ou null si rien d'exploitable. */
  const current = (): Answer | null => {
    switch (question.type) {
      case "numeric":
        if (question.slider) return slide;
        return parseNumberInput(value);
      case "short_text":
      case "dictation":
        return value.trim() || null;
      case "order": {
        const items = question.items ?? [];
        if (!picked.length) return null;
        return [...picked, ...items.filter((i) => !picked.includes(i))];
      }
      case "size":
        return Math.round(ratio * 100) / 100;
      default:
        return choice;
    }
  };

  const send = (answer: Answer | null) => {
    if (sent.current) return;
    sent.current = true;
    onSubmit(answer);
  };

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  useEffect(() => {
    if (expired && !disabled) send(current());
    // Volontaire : on n'envoie qu'une fois, au moment où le chrono expire (la saisie lue est la dernière).
  }, [expired]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const answer = current();
    if (answer === null) {
      setError(
        {
          numeric: question.slider ? "Déplace le curseur" : "Un nombre, par exemple 1 250 ou 3,5",
          short_text: "Écris ta réponse",
          dictation: "Écris la phrase",
          order: "Touche les éléments dans l'ordre",
        }[question.type as string] ?? "Choisis une réponse",
      );
      return;
    }
    if (question.type === "order" && picked.length < (question.items?.length ?? 0) - 1) {
      setError("Touche tous les éléments dans l'ordre");
      return;
    }
    send(answer);
  };

  const options: { label: string; value: Answer }[] =
    question.type === "binary"
      ? [
          { label: "Vrai", value: true },
          { label: "Faux", value: false },
        ]
      : (question.choices ?? []).map((c) => ({ label: c, value: c }));

  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Ta réponse">
      {(question.type === "binary" || question.type === "mcq") && (
        <div role="radiogroup" aria-label="Choix" className={question.type === "binary" ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
          {options.map((opt) => {
            const selected = choice === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => {
                  setChoice(opt.value);
                  setError(null);
                }}
                className={`min-h-[56px] rounded-2xl px-5 text-left text-base font-semibold transition ${question.type === "binary" ? "text-center text-lg" : ""} ${
                  selected ? "bg-accent text-white" : "bg-ink/5 hover:bg-ink/10"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
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
      {question.type === "numeric" && question.slider && (
        <SliderInput
          {...question.slider}
          unit={question.unit}
          value={slide}
          disabled={disabled}
          onChange={(v) => {
            setSlide(v);
            setError(null);
          }}
        />
      )}
      {question.type === "dictation" && <Listen speech={question.speech} />}

      {((question.type === "numeric" && !question.slider) || question.type === "short_text") && (
        <div className="relative">
          <label htmlFor="answer" className="sr-only">
            {question.type === "numeric" ? "Ton estimation" : "Ta réponse"}
          </label>
          <input
            id="answer"
            ref={inputRef}
            className="input min-h-[56px] pr-16 text-xl font-semibold"
            inputMode={question.type === "numeric" ? "decimal" : "text"}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder={question.type === "numeric" ? "Ton estimation" : "Ta réponse"}
          />
          {question.unit && question.type === "numeric" && (
            <span className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 font-semibold text-muted">{question.unit}</span>
          )}
        </div>
      )}
      {question.type === "dictation" && (
        <textarea
          id="answer"
          ref={inputRef}
          className="input min-h-[120px] text-lg"
          rows={4}
          autoComplete="off"
          autoCapitalize="sentences"
          spellCheck={false}
          aria-label="Ta dictée"
          placeholder="Écris ce que tu entends"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
      )}

      {error && (
        <p className="text-sm font-semibold text-bad" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn-dark w-full text-lg" disabled={disabled}>
        Valider
      </button>
    </form>
  );
}

/** Remettre dans l'ordre : on touche les éléments un par un. */
function OrderInput({
  items,
  picked,
  disabled,
  onChange,
}: {
  items: string[];
  picked: string[];
  disabled: boolean;
  onChange: (p: string[]) => void;
}) {
  return (
    <div className="space-y-2" aria-label="Classement">
      {items.map((item) => {
        const rank = picked.indexOf(item);
        const chosen = rank >= 0;
        return (
          <button
            key={item}
            type="button"
            disabled={disabled}
            data-testid="order-item"
            onClick={() => onChange(chosen ? picked.filter((p) => p !== item) : [...picked, item])}
            className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 text-left text-base font-semibold transition ${chosen ? "bg-accent text-white" : "bg-ink/5 hover:bg-ink/10"}`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${chosen ? "bg-white text-accent" : "border-2 border-dashed border-ink/20"}`}
            >
              {chosen ? rank + 1 : ""}
            </span>
            {item}
          </button>
        );
      })}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Touche dans l'ordre · retouche pour annuler</span>
        {picked.length > 0 && (
          <button type="button" className="font-semibold text-ink" onClick={() => onChange([])}>
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}

/** Comparer deux objets : la référence est fixe, on ajuste la cible (échelle logarithmique). */
function SizeInput({
  config,
  ratio,
  disabled,
  onChange,
}: {
  config: NonNullable<Q["size"]>;
  ratio: number;
  disabled: boolean;
  onChange: (r: number) => void;
}) {
  const lo = Math.log(config.min),
    hi = Math.log(config.max);
  const pos = ((Math.log(ratio) - lo) / (hi - lo)) * 1000;
  const box = 170;
  const unit = Math.min(72, box / Math.max(1, ratio));
  const refSize = Math.max(10, unit);
  const targetSize = Math.max(10, unit * ratio);
  return (
    <div className="space-y-4">
      <div className="flex h-[200px] items-end justify-center gap-6 rounded-2xl bg-ink/5 px-4 pb-4" aria-hidden="true">
        <div className="flex flex-col items-center gap-1">
          <span style={{ fontSize: refSize, lineHeight: 1 }}>{config.reference.emoji}</span>
          <span className="text-xs font-semibold text-muted">{config.reference.label}</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span style={{ fontSize: targetSize, lineHeight: 1 }} className="transition-[font-size] duration-75">
            {config.target.emoji}
          </span>
          <span className="text-xs font-semibold text-muted">{config.target.label}</span>
        </div>
      </div>
      <div className="text-center font-display text-4xl font-extrabold" data-testid="size-value">
        × {formatNumber(Math.round(ratio * 100) / 100)}
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        step={1}
        value={pos}
        disabled={disabled}
        aria-label={`Taille de ${config.target.label} par rapport à ${config.reference.label}`}
        onChange={(e) => onChange(Math.exp(lo + (Number(e.target.value) / 1000) * (hi - lo)))}
        className="w-full accent-[rgb(var(--accent))]"
      />
      <div className="flex justify-between text-xs text-muted">
        <span>× {formatNumber(config.min)}</span>
        <span>× {formatNumber(config.max)}</span>
      </div>
    </div>
  );
}

function SliderInput({
  min,
  max,
  step,
  unit,
  value,
  disabled,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  unit: string | null;
  value: number | null;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const shown = value ?? Math.round((min + max) / 2 / step) * step;
  return (
    <div className="space-y-3">
      <div
        className={`text-center font-display text-5xl font-extrabold ${value === null ? "text-muted/50" : ""}`}
        data-testid="slider-value"
      >
        {formatNumber(shown)}
        {unit ? <span className="ml-1 text-2xl">{unit}</span> : null}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        disabled={disabled}
        aria-label="Curseur"
        onChange={(e) => onChange(Number(e.target.value))}
        onClick={() => value === null && onChange(shown)}
        className="w-full accent-[rgb(var(--accent))]"
      />
      <div className="flex justify-between text-xs text-muted">
        <span>{formatNumber(min)}</span>
        <span>{formatNumber(max)}</span>
      </div>
    </div>
  );
}

function decode(speech?: string): string {
  if (!speech) return "";
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(speech), (c) => c.charCodeAt(0)));
  } catch {
    return "";
  }
}

/** Dictée : lecture par la synthèse vocale du téléphone, réécoute illimitée. */
function Listen({ speech }: { speech?: string }) {
  const [playing, setPlaying] = useState(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const text = decode(speech);
  const play = (rate: number) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = rate;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("fr"));
    if (voice) u.voice = voice;
    u.onend = () => setPlaying(false);
    setPlaying(true);
    window.speechSynthesis.speak(u);
  };
  useEffect(
    () => () => {
      if (supported) window.speechSynthesis.cancel();
    },
    [supported],
  );
  if (!supported) return <p className="rounded-2xl bg-mid/15 p-4 text-sm">Son indisponible sur cet appareil.</p>;
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <button type="button" className="btn-primary text-lg" onClick={() => play(0.85)} data-testid="listen">
        {playing ? "🔊 Lecture…" : "▶ Écouter"}
      </button>
      <button type="button" className="btn-ghost" onClick={() => play(0.6)} aria-label="Écouter lentement">
        🐢
      </button>
    </div>
  );
}
