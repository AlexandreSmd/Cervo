// Vrai / Faux et QCM : toucher un choix, c'est répondre. Au clavier : 1 à 4 (ou V et F).
import { useEffect } from "react";
import type { Answer } from "../../lib/types";

/** Touche du clavier pour chaque choix (montrée seulement sur ordinateur). */
function keyFor(index: number, binary: boolean): string {
  return binary ? (index === 0 ? "V" : "F") : String(index + 1);
}

export function ChoiceInput({
  options,
  value,
  binary,
  disabled,
  busy = false,
  onChange,
}: {
  options: { label: string; value: Answer }[];
  value: Answer | null;
  binary: boolean;
  disabled: boolean;
  /** Réponse envoyée : le choix touché reste marqué pendant la vérification. */
  busy?: boolean;
  onChange: (v: Answer) => void;
}) {
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest?.("input, textarea, select")) return;
      const k = e.key.toUpperCase();
      const index = options.findIndex((_, i) => keyFor(i, binary) === k || String(i + 1) === k);
      if (index >= 0) {
        e.preventDefault();
        onChange(options[index].value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, options, binary, onChange]);

  return (
    <div role="radiogroup" aria-label="Choix" className={binary ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
      {options.map((opt, i) => {
        const selected = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`min-h-[56px] rounded-xl border-2 px-5 text-base font-semibold transition active:scale-[0.98] ${binary ? "text-center text-lg" : "text-left"} ${
              selected
                ? `border-ink bg-ink text-bg ${busy ? "busy-stripes" : ""}`
                : `border-ink/15 bg-card hover:border-ink/40 ${busy ? "opacity-50" : ""}`
            }`}
          >
            <span className="flex items-center gap-3">
              <kbd
                className={`hidden h-6 min-w-6 shrink-0 items-center justify-center rounded-md border px-1.5 font-sans text-xs font-bold [@media(hover:hover)]:inline-flex ${
                  selected ? "border-bg/40 text-bg" : "border-ink/20 text-muted"
                } ${binary ? "order-last" : ""}`}
                aria-hidden="true"
              >
                {keyFor(i, binary)}
              </kbd>
              <span className={binary ? "flex-1" : ""}>{opt.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
