// Devinette : les indices arrivent un par un, du plus vague au plus précis.
// Chaque indice demandé fait baisser les points ; on peut répondre à tout moment.

/** Points selon le nombre d'indices vus (miroir de api/cervo/domain/scoring.py). */
export const CLUE_SCORES = [100, 75, 50, 30, 20];

export function cluePoints(seen: number): number {
  return CLUE_SCORES[Math.min(Math.max(seen, 1), CLUE_SCORES.length) - 1];
}

export function RiddleInput({
  clues,
  total,
  value,
  disabled,
  asking,
  onChange,
  onClue,
  inputRef,
}: {
  clues: string[];
  total: number;
  value: string;
  disabled: boolean;
  asking: boolean;
  onChange: (v: string) => void;
  onClue?: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  const more = clues.length < total;
  return (
    <div className="space-y-3">
      <ol className="space-y-2" aria-label="Indices" aria-live="polite">
        {clues.map((clue, i) => (
          <li key={i} className="flex animate-rise gap-3 rounded-2xl bg-ink/5 px-4 py-3" data-testid="clue">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-extrabold text-white">
              {i + 1}
            </span>
            <span className="text-[15px] font-semibold leading-snug">{clue}</span>
          </li>
        ))}
        {Array.from({ length: total - clues.length }, (_, i) => (
          <li key={`hidden-${i}`} className="flex gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-3 text-muted">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-line text-xs font-extrabold">
              {clues.length + i + 1}
            </span>
            <span className="text-sm">Indice caché</span>
          </li>
        ))}
      </ol>
      {more && onClue && (
        <button type="button" className="btn-ghost w-full" onClick={onClue} disabled={disabled || asking} data-testid="next-clue">
          {asking ? "…" : `Indice suivant · la réponse vaudra ${cluePoints(clues.length + 1)} pts`}
        </button>
      )}
      <div className="relative">
        <input
          id="answer"
          ref={inputRef}
          className="input min-h-[56px] pr-20 text-xl font-semibold"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Ta réponse"
          placeholder="Ta réponse"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <span
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-accent"
          data-testid="riddle-points"
        >
          {cluePoints(clues.length)} pts
        </span>
      </div>
    </div>
  );
}
