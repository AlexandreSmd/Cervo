// Vrai / Faux et QCM : on touche un choix, puis on valide.
import type { Answer } from "../../lib/types";

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
  return (
    <div role="radiogroup" aria-label="Choix" className={binary ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
      {options.map((opt) => {
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
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
