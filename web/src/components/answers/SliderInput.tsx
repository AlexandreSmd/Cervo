// Curseur borné (estimation sur une frise, par exemple).
import { formatNumber } from "../../lib/format";

export function SliderInput({
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
        // Toucher le curseur sans le bouger, c'est choisir la valeur affichée (dès l'appui, au doigt comme à la souris).
        onPointerDown={() => value === null && onChange(shown)}
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
