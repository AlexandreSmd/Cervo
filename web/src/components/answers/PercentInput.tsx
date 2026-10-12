// Statistique : « sur 100 personnes, combien… ? ». Le pourcentage se lit sur 100 points.

/** 100 points : les `value` premiers sont pleins (et `truth` montre la réalité après la réponse). */
export function HundredDots({ value, truth }: { value: number | null; truth?: number }) {
  const mine = value === null ? -1 : Math.round(value);
  return (
    <div className="grid grid-cols-10 gap-1" aria-hidden="true">
      {Array.from({ length: 100 }, (_, i) => {
        const inTruth = truth !== undefined && i < Math.round(truth);
        const inMine = i < mine;
        const color = truth !== undefined ? (inTruth ? "bg-good" : inMine ? "bg-ink/30" : "bg-ink/10") : inMine ? "bg-accent" : "bg-ink/10";
        return <span key={i} className={`aspect-square rounded-full transition-colors duration-75 ${color}`} />;
      })}
    </div>
  );
}

export function PercentInput({ value, disabled, onChange }: { value: number | null; disabled: boolean; onChange: (v: number) => void }) {
  const shown = value ?? 50;
  return (
    <div className="space-y-4">
      <div
        className={`text-center font-display text-6xl font-extrabold ${value === null ? "text-muted/40" : ""}`}
        data-testid="percent-value"
      >
        {shown}
        <span className="ml-1 text-3xl">%</span>
      </div>
      <div className="mx-auto max-w-[180px]">
        <HundredDots value={value} />
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={shown}
        disabled={disabled}
        aria-label="Pourcentage"
        onChange={(e) => onChange(Number(e.target.value))}
        onClick={() => value === null && onChange(shown)}
        className="w-full accent-[rgb(var(--accent))]"
      />
      <div className="flex justify-between text-xs text-muted">
        <span>0 %</span>
        <span>100 %</span>
      </div>
    </div>
  );
}
