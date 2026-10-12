// Rappel (mémoire) : réécrire ce qu'on vient de voir. Une suite de chiffres se tape d'un bloc ;
// une liste de mots se tape séparée par des virgules ou des espaces.
import type { PublicQuestion } from "../../lib/types";

export function recallTokens(raw: string, singleChars: boolean): string[] {
  if (singleChars) return Array.from(raw.replace(/[^0-9A-Za-zÀ-ÿ]/g, ""));
  return raw
    .split(/[\s,;/]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function RecallInput({
  recall,
  value,
  disabled,
  onChange,
  inputRef,
}: {
  recall: NonNullable<PublicQuestion["recall"]>;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  const tokens = recallTokens(value, recall.single_chars);
  const digits = recall.single_chars && /^[0-9]*$/.test(value.replace(/\s/g, ""));
  return (
    <div className="space-y-3">
      <input
        id="answer"
        ref={inputRef}
        className={`input min-h-[64px] text-center font-display font-extrabold ${recall.single_chars ? "text-3xl tracking-[0.35em]" : "text-xl"}`}
        inputMode={digits ? "numeric" : "text"}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Ce dont tu te souviens"
        placeholder={recall.single_chars ? "•".repeat(recall.count) : "mot, mot, mot…"}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{recall.ordered ? "Dans l'ordre" : "Dans n'importe quel ordre"}</span>
        <span className={`font-semibold ${tokens.length === recall.count ? "text-good" : ""}`} data-testid="recall-count">
          {tokens.length} / {recall.count}
        </span>
      </div>
    </div>
  );
}
