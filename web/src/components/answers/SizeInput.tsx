// Taille : la référence est fixe, le joueur agrandit ou réduit l'autre objet (échelle logarithmique).
import { formatNumber } from "../../lib/format";
import type { SizeConfig } from "../../lib/types";

/** Les deux objets côte à côte, l'un à `ratio` fois la taille de l'autre. */
export function SizePair({ config, ratio, ghost }: { config: SizeConfig; ratio: number; ghost?: number }) {
  const box = 170;
  const biggest = Math.max(1, ratio, ghost ?? 0);
  const unit = Math.min(72, box / biggest);
  const px = (r: number) => Math.max(10, unit * r);
  return (
    <div className="flex h-[200px] items-end justify-center gap-6 rounded-2xl bg-ink/5 px-4 pb-4" aria-hidden="true">
      <div className="flex flex-col items-center gap-1">
        <span style={{ fontSize: px(1), lineHeight: 1 }}>{config.reference.emoji}</span>
        <span className="text-xs font-semibold text-muted">{config.reference.label}</span>
      </div>
      {ghost !== undefined && (
        <div className="flex flex-col items-center gap-1 opacity-35">
          <span style={{ fontSize: px(ghost), lineHeight: 1 }}>{config.target.emoji}</span>
          <span className="text-xs font-semibold text-muted">Toi</span>
        </div>
      )}
      <div className="flex flex-col items-center gap-1">
        <span style={{ fontSize: px(ratio), lineHeight: 1 }} className="transition-[font-size] duration-75">
          {config.target.emoji}
        </span>
        <span className="text-xs font-semibold text-muted">{config.target.label}</span>
      </div>
    </div>
  );
}

export function SizeInput({
  config,
  ratio,
  disabled,
  onChange,
}: {
  config: SizeConfig;
  ratio: number;
  disabled: boolean;
  onChange: (r: number) => void;
}) {
  const lo = Math.log(config.min),
    hi = Math.log(config.max);
  const pos = ((Math.log(ratio) - lo) / (hi - lo)) * 1000;
  return (
    <div className="space-y-4">
      <SizePair config={config} ratio={ratio} />
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
        <span>plus petit</span>
        <span>plus grand</span>
      </div>
    </div>
  );
}
