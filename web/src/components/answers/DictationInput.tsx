// Dictée : deux phrases lues par la voix du téléphone. Sans chrono : on réécoute tout ou une phrase,
// aussi souvent qu'on veut, à la vitesse qu'on veut.
import { useEffect, useMemo, useState } from "react";
import { sentences } from "../../lib/diff";
import { decodeSpeech, speak, speechSupported, stopSpeaking } from "../../lib/speech";

const SPEEDS = [
  { key: "slow", label: "Lent", rate: 0.7 },
  { key: "normal", label: "Normal", rate: 0.9 },
  { key: "fast", label: "Rapide", rate: 1.15 },
] as const;

export function DictationInput({
  speech,
  value,
  disabled,
  onChange,
  inputRef,
}: {
  speech?: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}) {
  const text = useMemo(() => decodeSpeech(speech), [speech]);
  const parts = useMemo(() => sentences(text), [text]);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]["key"]>("normal");
  const [playing, setPlaying] = useState<number | "all" | null>(null);
  const [listens, setListens] = useState(0);
  const supported = speechSupported();

  useEffect(() => stopSpeaking, []);

  const play = (what: number | "all") => {
    const rate = SPEEDS.find((s) => s.key === speed)!.rate;
    setPlaying(what);
    setListens((n) => n + 1);
    speak(what === "all" ? text : parts[what], rate, () => setPlaying(null));
  };

  return (
    <div className="space-y-3">
      {supported ? (
        <div className="space-y-2 rounded-2xl bg-ink/5 p-3">
          <button type="button" className="btn-primary w-full text-lg" onClick={() => play("all")} data-testid="listen">
            {playing === "all" ? "🔊 Lecture…" : listens ? "↻ Réécouter tout" : "▶ Écouter la dictée"}
          </button>
          {parts.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {parts.map((_, i) => (
                <button key={i} type="button" className="btn-ghost btn-sm bg-card" onClick={() => play(i)} data-testid={`listen-${i + 1}`}>
                  {playing === i ? "🔊" : "▶"} Phrase {i + 1}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1 rounded-full bg-card p-1" role="radiogroup" aria-label="Vitesse de lecture">
            {SPEEDS.map((s) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={speed === s.key}
                onClick={() => setSpeed(s.key)}
                className={`flex-1 rounded-full py-1.5 text-sm font-semibold ${speed === s.key ? "bg-ink text-bg" : "text-muted"}`}
              >
                {s.key === "slow" ? "🐢 " : s.key === "fast" ? "🐇 " : ""}
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="rounded-2xl bg-mid/15 p-4 text-sm">Son indisponible sur cet appareil : essaie depuis un autre navigateur.</p>
      )}
      <textarea
        id="answer"
        ref={inputRef}
        className="input min-h-[140px] text-lg leading-relaxed"
        rows={5}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="sentences"
        spellCheck={false}
        aria-label="Ta dictée"
        placeholder="Écris ce que tu entends"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-center text-xs text-muted">Sans chrono · l'orthographe et les accents comptent</p>
    </div>
  );
}
