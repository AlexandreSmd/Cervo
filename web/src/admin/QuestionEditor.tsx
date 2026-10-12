// Éditeur de question, guidé par le type : on choisit l'un des 10 types, puis le formulaire ne
// demande que ce que ce type utilise. Aperçu joueur en direct, chrono calculé affiché.
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AnswerInput } from "../components/AnswerInput";
import { QuestionHeader } from "../components/QuestionCard";
import { api } from "../lib/api";
import { speak, stopSpeaking } from "../lib/speech";
import type { AdminQuestion, PublicQuestion, QuestionType } from "../lib/types";
import { fromQuestion, memorizedItems, newDraft, num, toPayload, type Draft } from "./editor/draft";
import { ImageSlot } from "./editor/ImageSlot";
import {
  ANSWER_FORMATS,
  ANSWER_HINTS,
  computeMemorizeSeconds,
  computeTimeLimit,
  DIFFICULTIES,
  KIND_RULES,
  KINDS,
  STATUSES,
  kindInfo,
} from "./meta";
import { Rate, Segmented } from "./ui";

type Set = <K extends keyof Draft>(k: K, v: Draft[K]) => void;

/** Choix du type : la première étape d'une nouvelle question. */
export function KindPicker({ onPick }: { onPick: (category: string) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Chaque jour, le quiz pose une question de chaque type, dans cet ordre. Quel type veux-tu écrire ?
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {KINDS.map((k, i) => (
          <button
            key={k.key}
            className="flex gap-3 rounded-2xl bg-card p-4 text-left transition hover:ring-2 hover:ring-accent"
            onClick={() => onPick(k.key)}
            data-testid={`kind-${k.key}`}
          >
            <span className="text-3xl" aria-hidden="true">
              {k.emoji}
            </span>
            <span className="min-w-0">
              <span className="block font-bold">
                {i + 1}. {k.label}
              </span>
              <span className="text-sm text-muted">{KIND_RULES[k.key].guide}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold">{label}</p>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input py-2 text-base ${props.className ?? ""}`} />;
}

/** 4 choix, dont un juste (bouton radio). */
function ChoicesField({ d, set }: { d: Draft; set: Set }) {
  return (
    <Field label="Les 4 choix" hint="Coche la bonne réponse. L'ordre est mélangé pour le joueur.">
      {d.choices.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="radio"
            name="correct"
            className="h-5 w-5 accent-[rgb(var(--accent))]"
            aria-label={`Choix ${i + 1} correct`}
            checked={!!c && d.correct === c}
            onChange={() => set("correct", c)}
            required
          />
          <Input
            aria-label={`Choix ${i + 1}`}
            placeholder={`Choix ${i + 1}`}
            value={c}
            required
            onChange={(e) => {
              const next = [...d.choices];
              next[i] = e.target.value;
              set("choices", next);
              if (d.correct === c) set("correct", e.target.value);
            }}
          />
        </div>
      ))}
    </Field>
  );
}

function TrueFalseField({ d, set }: { d: Draft; set: Set }) {
  return (
    <Segmented
      label="Bonne réponse"
      value={d.correct}
      onChange={(v) => set("correct", v)}
      options={[
        ["true", "Vrai"],
        ["false", "Faux"],
      ]}
    />
  );
}

function AnswerTextField({ d, set, label = "Bonne réponse" }: { d: Draft; set: Set; label?: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Input aria-label={label} placeholder={label} value={d.correct} onChange={(e) => set("correct", e.target.value)} required />
      <Input
        aria-label="Autres réponses acceptées"
        placeholder="Autres réponses acceptées, séparées par |"
        value={d.aliases}
        onChange={(e) => set("aliases", e.target.value)}
      />
    </div>
  );
}

/** Mécanique de réponse, quand le type en propose plusieurs. */
function MechanicField({ d, setDraft }: { d: Draft; setDraft: (d: Draft) => void }) {
  const types = KIND_RULES[d.category].answerTypes;
  if (types.length < 2) return null;
  return (
    <Field label="Mécanique" hint={ANSWER_HINTS[d.type]}>
      <Segmented
        label="Mécanique de réponse"
        value={d.type}
        onChange={(t: QuestionType) => setDraft({ ...d, type: t, correct: t === "binary" ? "true" : "" })}
        options={types.map((t) => [t, ANSWER_FORMATS[t]] as [QuestionType, string])}
      />
    </Field>
  );
}

/** Le cœur du formulaire : ce que ce type demande d'écrire. */
function KindFields({ d, set, setDraft }: { d: Draft; set: Set; setDraft: (d: Draft) => void }) {
  const prompt = (placeholder: string, rows = 2) => (
    <textarea
      className="input text-base"
      rows={rows}
      placeholder={placeholder}
      aria-label="Question"
      value={d.prompt}
      onChange={(e) => set("prompt", e.target.value)}
      required
      minLength={5}
    />
  );

  switch (d.category) {
    case "vocabulaire":
      return (
        <>
          {prompt("Quel est le synonyme de « … » ?")}
          <ChoicesField d={d} set={set} />
        </>
      );

    case "taille": {
      const obj = (which: "reference" | "target", label: string) => (
        <div className="grid grid-cols-[72px_1fr] gap-2">
          <Input
            className="text-center text-2xl"
            placeholder="🗼"
            aria-label={`Emoji : ${label}`}
            value={d.size[which].emoji}
            onChange={(e) => set("size", { ...d.size, [which]: { ...d.size[which], emoji: e.target.value } })}
            required
          />
          <Input
            placeholder={label}
            aria-label={label}
            value={d.size[which].label}
            onChange={(e) => set("size", { ...d.size, [which]: { ...d.size[which], label: e.target.value } })}
            required
          />
        </div>
      );
      return (
        <>
          {prompt("Ajuste … par rapport à … (hauteur).")}
          <Field label="Les deux objets" hint="La référence reste fixe ; le joueur agrandit ou réduit l'autre.">
            {obj("reference", "Objet de référence (fixe)")}
            {obj("target", "Objet à ajuster")}
          </Field>
          <SizeRatioField d={d} set={set} />
        </>
      );
    }

    case "fait":
      return (
        <>
          <MechanicField d={d} setDraft={setDraft} />
          {prompt(d.type === "binary" ? "Une affirmation surprenante (vraie ou fausse)." : "Une question sur un fait surprenant.")}
          {d.type === "binary" ? <TrueFalseField d={d} set={set} /> : <ChoicesField d={d} set={set} />}
        </>
      );

    case "memoire": {
      const items = memorizedItems(d);
      return (
        <>
          <Field label="Ce que le joueur mémorise" hint="Un élément par ligne : mots, chiffres, emojis.">
            <textarea
              className="input text-base"
              rows={4}
              placeholder={"🦊 Renard\n🍉 Pastèque\n🚀 Fusée"}
              aria-label="Éléments à mémoriser"
              value={d.memItems}
              onChange={(e) => set("memItems", e.target.value)}
              required
            />
          </Field>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">Affiché</span>
            <Input
              className="w-20"
              aria-label="Secondes d'affichage"
              placeholder={String(computeMemorizeSeconds(items.length, d.difficulty))}
              value={d.memSeconds}
              onChange={(e) => set("memSeconds", e.target.value)}
            />
            <span className="text-muted">s (vide = {computeMemorizeSeconds(items.length, d.difficulty)} s, calculé)</span>
          </div>
          <MechanicField d={d} setDraft={setDraft} />
          {prompt(
            d.type === "recall"
              ? "Retape-les, dans l'ordre."
              : d.type === "order"
                ? "Remets-les dans l'ordre où ils sont apparus."
                : "Lequel n'était PAS dans la liste ?",
          )}
          {d.type === "recall" && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={d.recallOrdered} onChange={(e) => set("recallOrdered", e.target.checked)} /> L'ordre compte
            </label>
          )}
          {d.type === "mcq" && <ChoicesField d={d} set={set} />}
          {d.type !== "mcq" && (
            <p className="text-xs text-muted">
              Réponse attendue : les éléments mémorisés,{" "}
              {d.type === "order" || d.recallOrdered ? "dans l'ordre" : "dans n'importe quel ordre"}.
            </p>
          )}
        </>
      );
    }

    case "stat":
      return (
        <>
          {prompt("Quelle part de … ?")}
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Pourcentage réel">
              <Input
                inputMode="decimal"
                aria-label="Pourcentage réel"
                placeholder="71"
                value={d.correct}
                onChange={(e) => set("correct", e.target.value)}
                required
              />
            </Field>
            <Field label="0 point à … points d'écart" hint="Vide = 20 points.">
              <Input
                inputMode="decimal"
                aria-label="Tolérance"
                placeholder="20"
                value={d.tolerance}
                onChange={(e) => set("tolerance", e.target.value)}
              />
            </Field>
          </div>
        </>
      );

    case "chronologie":
      return (
        <>
          {prompt("Classe ces événements, du plus ancien au plus récent.")}
          <Field label="Événements, du plus ancien au plus récent" hint="Mélangés pour le joueur. La date s'affiche après sa réponse.">
            {d.items.map((item, i) => (
              <div key={i} className="grid grid-cols-[24px_1fr_140px_auto] items-center gap-2">
                <span className="text-center font-bold text-muted">{i + 1}</span>
                <Input
                  aria-label={`Événement ${i + 1}`}
                  placeholder={`Événement ${i + 1}`}
                  value={item}
                  onChange={(e) =>
                    set(
                      "items",
                      d.items.map((x, j) => (j === i ? e.target.value : x)),
                    )
                  }
                  required={i < 3}
                />
                <Input
                  aria-label={`Date ${i + 1}`}
                  placeholder="1789"
                  value={d.details[i] ?? ""}
                  onChange={(e) =>
                    set(
                      "details",
                      d.items.map((_, j) => (j === i ? e.target.value : (d.details[j] ?? ""))),
                    )
                  }
                  required={!!item}
                />
                <span className="flex gap-1">
                  <button
                    type="button"
                    className="chip"
                    aria-label="Monter"
                    disabled={i === 0}
                    onClick={() => setDraft(swapRows(d, i, i - 1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="chip"
                    aria-label="Descendre"
                    disabled={i === d.items.length - 1}
                    onClick={() => setDraft(swapRows(d, i, i + 1))}
                  >
                    ↓
                  </button>
                </span>
              </div>
            ))}
            <div className="flex gap-2 text-xs">
              {d.items.length < 6 && (
                <button
                  type="button"
                  className="chip"
                  onClick={() => setDraft({ ...d, items: [...d.items, ""], details: [...d.details, ""] })}
                >
                  + événement
                </button>
              )}
              {d.items.length > 3 && (
                <button
                  type="button"
                  className="chip"
                  onClick={() => setDraft({ ...d, items: d.items.slice(0, -1), details: d.details.slice(0, -1) })}
                >
                  − événement
                </button>
              )}
            </div>
          </Field>
        </>
      );

    case "estimation":
      return (
        <>
          {prompt("Combien pèse en moyenne … ?")}
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Bonne réponse">
              <Input
                inputMode="decimal"
                aria-label="Bonne réponse"
                placeholder="6"
                value={d.correct}
                onChange={(e) => set("correct", e.target.value)}
                required
              />
            </Field>
            <Field label="Unité">
              <Input aria-label="Unité" placeholder="tonnes" value={d.unit} onChange={(e) => set("unit", e.target.value)} />
            </Field>
            <Field label="100 points à ± … près">
              <Input
                inputMode="decimal"
                aria-label="Marge exacte"
                placeholder="0"
                value={d.margin}
                onChange={(e) => set("margin", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Exigence" hint="0 point quand on se trompe de ce facteur (trop ou pas assez).">
            <Segmented
              label="Facteur"
              value={d.factor}
              onChange={(v) => set("factor", v)}
              options={[
                ["1.5", "Stricte (×1,5)"],
                ["2", "Normale (×2)"],
                ["3", "Large (×3)"],
              ]}
            />
          </Field>
        </>
      );

    case "devinette":
      return (
        <>
          <div className="flex flex-wrap gap-2">
            {["Quel animal suis-je ?", "Quel pays suis-je ?", "Qui suis-je ?", "Quel objet suis-je ?"].map((p) => (
              <button key={p} type="button" className={`chip ${d.prompt === p ? "bg-ink text-bg" : ""}`} onClick={() => set("prompt", p)}>
                {p}
              </button>
            ))}
          </div>
          {prompt("Quel animal suis-je ?", 1)}
          <Field label="Indices, du plus vague au plus précis" hint="Le 1er est offert (100 pts), puis 75, 50, 30, 20 pts.">
            {d.clues.map((clue, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-14 shrink-0 text-xs font-bold text-muted">{[100, 75, 50, 30, 20][i]} pts</span>
                <Input
                  aria-label={`Indice ${i + 1}`}
                  placeholder={`Indice ${i + 1}`}
                  value={clue}
                  onChange={(e) =>
                    set(
                      "clues",
                      d.clues.map((c, j) => (j === i ? e.target.value : c)),
                    )
                  }
                  required={i < 3}
                />
              </div>
            ))}
            <div className="flex gap-2 text-xs">
              {d.clues.length < 5 && (
                <button type="button" className="chip" onClick={() => set("clues", [...d.clues, ""])}>
                  + indice
                </button>
              )}
              {d.clues.length > 3 && (
                <button type="button" className="chip" onClick={() => set("clues", d.clues.slice(0, -1))}>
                  − indice
                </button>
              )}
            </div>
          </Field>
          <AnswerTextField d={d} set={set} label="Réponse (koala, Islande…)" />
          <p className="text-xs text-muted">Majuscules, accents et articles (le, la, l'…) sont ignorés.</p>
        </>
      );

    case "enigme":
      return (
        <>
          {prompt("L'énoncé de l'énigme", 4)}
          <MechanicField d={d} setDraft={setDraft} />
          {d.type === "mcq" ? <ChoicesField d={d} set={set} /> : <AnswerTextField d={d} set={set} />}
        </>
      );

    case "dictee":
      return <DictationField d={d} set={set} />;
  }
  return null;
}

function swapRows(d: Draft, a: number, b: number): Draft {
  const items = [...d.items];
  const details = d.items.map((_, i) => d.details[i] ?? "");
  [items[a], items[b]] = [items[b], items[a]];
  [details[a], details[b]] = [details[b], details[a]];
  return { ...d, items, details };
}

/** Rapport de tailles, avec une calculette à partir des tailles réelles. */
function SizeRatioField({ d, set }: { d: Draft; set: Set }) {
  const [refSize, setRefSize] = useState("");
  const [targetSize, setTargetSize] = useState("");
  const compute = (r: string, t: string) => {
    const a = num(r);
    const b = num(t);
    if (a && b) set("correct", String(Math.round((b / a) * 100) / 100));
  };
  return (
    <Field
      label="Rapport réel"
      hint="Taille de l'objet à ajuster ÷ taille de la référence. Plein score à 1 % près, 0 point à un facteur 2."
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
        <Input
          inputMode="decimal"
          aria-label="Taille réelle de la référence"
          placeholder="Taille réf. (330)"
          value={refSize}
          onChange={(e) => {
            setRefSize(e.target.value);
            compute(e.target.value, targetSize);
          }}
        />
        <span className="hidden text-center text-muted sm:block">et</span>
        <Input
          inputMode="decimal"
          aria-label="Taille réelle de l'objet à ajuster"
          placeholder="Taille objet (93)"
          value={targetSize}
          onChange={(e) => {
            setTargetSize(e.target.value);
            compute(refSize, e.target.value);
          }}
        />
        <span className="hidden text-center text-muted sm:block">→</span>
        <Input
          inputMode="decimal"
          aria-label="Rapport réel"
          placeholder="0,28"
          value={d.correct}
          onChange={(e) => set("correct", e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          inputMode="decimal"
          aria-label="Curseur min"
          placeholder="Curseur min (0,1)"
          value={String(d.size.min)}
          onChange={(e) => set("size", { ...d.size, min: num(e.target.value) ?? 0.1 })}
        />
        <Input
          inputMode="decimal"
          aria-label="Curseur max"
          placeholder="Curseur max (10)"
          value={String(d.size.max)}
          onChange={(e) => set("size", { ...d.size, max: num(e.target.value) ?? 10 })}
        />
      </div>
    </Field>
  );
}

/** Dictée : le texte, avec un contrôle des deux phrases et une écoute de vérification. */
function DictationField({ d, set }: { d: Draft; set: Set }) {
  const [playing, setPlaying] = useState(false);
  const count = (d.correct.match(/[^.!?…]+[.!?…]+/g) ?? []).length;
  return (
    <>
      <Field
        label="Texte lu au joueur"
        hint="Deux phrases, ponctuées. La voix du téléphone les lit ; casse et ponctuation ne comptent pas, les accents si."
      >
        <textarea
          className="input text-base"
          rows={4}
          placeholder="Première phrase. Deuxième phrase."
          aria-label="Texte de la dictée"
          value={d.correct}
          onChange={(e) => set("correct", e.target.value)}
          required
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className={count === 2 ? "font-semibold text-good" : "font-semibold text-mid"}>
          {count} phrase{count > 1 ? "s" : ""}
          {count === 2 ? " ✓" : " (2 attendues)"}
        </span>
        <button
          type="button"
          className="chip"
          onClick={() => {
            if (playing) {
              stopSpeaking();
              setPlaying(false);
            } else {
              setPlaying(true);
              speak(d.correct, 0.9, () => setPlaying(false));
            }
          }}
        >
          {playing ? "■ Arrêter" : "▶ Écouter"}
        </button>
      </div>
    </>
  );
}

/** Aperçu joueur : ce que le joueur verra (mémorisation comprise). */
function Preview({ d }: { d: Draft }) {
  const kind = kindInfo(d.category);
  const items = memorizedItems(d);
  const payload = toPayload(d);
  const q: PublicQuestion = {
    id: "apercu",
    position: 0,
    type: d.type,
    category: d.category,
    category_label: kind.label,
    emoji: kind.emoji,
    instruction: KIND_RULES[d.category]?.instruction ?? null,
    pillar: kind.pillar,
    difficulty: d.difficulty,
    prompt: d.prompt || "Ta question apparaîtra ici",
    images: d.images.filter((i) => i.url),
    choices: d.type === "mcq" ? d.choices.map((c, i) => c || `Choix ${i + 1}`) : null,
    unit: d.unit || null,
    time_limit: null,
    items:
      d.type === "order"
        ? (d.category === "memoire" ? items : d.items.filter(Boolean)).slice().sort((a, b) => a.localeCompare(b))
        : undefined,
    size:
      d.type === "size"
        ? {
            ...d.size,
            reference: { label: d.size.reference.label || "Référence", emoji: d.size.reference.emoji || "🗼" },
            target: { label: d.size.target.label || "Objet", emoji: d.size.target.emoji || "🗽" },
          }
        : undefined,
    speech: d.type === "dictation" ? btoa(unescape(encodeURIComponent(d.correct))) : undefined,
    clues: d.type === "riddle" ? d.clues.filter(Boolean).slice(0, 1) : undefined,
    clue_total: d.type === "riddle" ? d.clues.filter(Boolean).length : undefined,
    recall:
      d.type === "recall" ? { count: items.length, ordered: d.recallOrdered, single_chars: items.every((i) => i.length === 1) } : undefined,
  };
  const timer = d.timeLimit ? num(d.timeLimit) : computeTimeLimit({ ...q, prompt: d.prompt, correct_answer: payload.correct_answer });
  return (
    <div className="space-y-3">
      <div className="rounded-[32px] border-8 border-ink/90 bg-bg p-3">
        <div className="card space-y-4 p-4">
          <p className="text-center text-xs font-semibold text-muted" data-testid="preview-timer">
            {timer ? `⏱ ${timer} s` : "Sans chrono"}
          </p>
          {d.category === "memoire" && items.length > 0 && (
            <div className="rounded-2xl bg-accent/10 p-3 text-center text-sm">
              <p className="mb-1 font-semibold">D'abord montré {d.memSeconds || computeMemorizeSeconds(items.length, d.difficulty)} s :</p>
              <p className="font-display font-bold">{items.join(" · ")}</p>
            </div>
          )}
          <QuestionHeader question={q} />
          <AnswerInput question={q} disabled onSubmit={() => undefined} />
        </div>
      </div>
    </div>
  );
}

export function QuestionEditor({
  question,
  initialKind,
  onSaved,
}: {
  question?: AdminQuestion;
  initialKind?: string;
  onSaved: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(question ? fromQuestion(question) : initialKind ? newDraft(initialKind) : null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  if (question?.legacy) {
    return (
      <div className="space-y-3 rounded-2xl bg-card p-5">
        <p className="font-bold">Ancienne question (avant les 10 types)</p>
        <p className="text-sm text-muted">
          Elle n'est plus posée, mais reste visible dans l'historique des joueurs. Pour la réutiliser, recrée-la dans l'un des 10 types.
        </p>
        <p className="font-semibold">{question.prompt}</p>
      </div>
    );
  }
  if (!draft) return <KindPicker onPick={(k) => setDraft(newDraft(k))} />;

  const set: Set = (k, v) => setDraft((s) => (s ? { ...s, [k]: v } : s));
  const kind = kindInfo(draft.category);
  const rules = KIND_RULES[draft.category];
  const computed = computeTimeLimit({ ...draft, correct_answer: toPayload(draft).correct_answer });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setSaving(true);
    try {
      const payload = toPayload(draft);
      let id = question?.id;
      if (question) {
        await api.admin.update(question.id, payload);
      } else {
        const res = await api.admin.import([payload]);
        if (res.errors.length) {
          setErrors(res.errors[0].errors);
          return;
        }
        id = res.created[0];
      }
      await qc.invalidateQueries();
      onSaved(id!);
    } catch (err) {
      setErrors([(err as Error).message]);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <form onSubmit={save} className="space-y-6" aria-label="Formulaire de question">
        <header className="flex items-start gap-3 rounded-2xl p-4" style={{ backgroundColor: `${kind.color}14` }}>
          <span className="text-4xl" aria-hidden="true">
            {kind.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold" style={{ color: kind.color }} data-testid="editor-kind">
              {kind.label}
            </span>
            <span className="text-sm text-muted">{rules.guide}</span>
          </span>
          {!question && (
            <button type="button" className="chip" onClick={() => setDraft(null)}>
              Changer
            </button>
          )}
        </header>

        <section className="space-y-4">
          <KindFields d={draft} set={set} setDraft={setDraft} />
        </section>

        {draft.category !== "dictee" && (
          <section className="space-y-2">
            <p className="text-sm font-semibold">Photos (facultatif)</p>
            {draft.images.map((img, i) => (
              <div key={i} className="space-y-1">
                <ImageSlot
                  index={i}
                  image={img}
                  labelled={draft.images.length > 1}
                  onChange={(next) =>
                    set(
                      "images",
                      draft.images.map((x, j) => (j === i ? next : x)),
                    )
                  }
                />
                <button
                  type="button"
                  className="text-xs text-muted hover:text-bad"
                  onClick={() =>
                    set(
                      "images",
                      draft.images.filter((_, j) => j !== i),
                    )
                  }
                >
                  Retirer la photo
                </button>
              </div>
            ))}
            {draft.images.length < 2 && (
              <button type="button" className="chip" onClick={() => set("images", [...draft.images, { url: "", alt: "", credit: "" }])}>
                + Ajouter une photo
              </button>
            )}
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          <Field label="Difficulté">
            <Segmented
              label="Difficulté"
              value={draft.difficulty}
              onChange={(v) => set("difficulty", v)}
              options={Object.entries(DIFFICULTIES).map(([k, v]) => [Number(k), v])}
            />
          </Field>
          <Field
            label="Chrono"
            hint={
              computed === null
                ? "Ce type se joue sans chrono."
                : `Vide = ${computed} s, calculé selon le type, la difficulté et la lecture.`
            }
          >
            <Input
              aria-label="Chrono en secondes"
              placeholder={computed === null ? "Sans chrono" : `${computed}`}
              value={draft.timeLimit}
              disabled={computed === null}
              onChange={(e) => set("timeLimit", e.target.value)}
            />
          </Field>
        </section>

        <section className="space-y-2">
          <Field label={draft.category === "fait" ? "Le savais-tu ? (le cœur de la question)" : "Explication, après la réponse"}>
            <textarea
              className="input text-base"
              rows={3}
              placeholder="Ce que le joueur apprend en découvrant la réponse."
              aria-label="Explication"
              value={draft.explanation}
              onChange={(e) => set("explanation", e.target.value)}
              required
              minLength={10}
            />
          </Field>
          <Input
            placeholder="Source (URL)"
            aria-label="Source"
            value={draft.sourceUrl}
            onChange={(e) => set("sourceUrl", e.target.value)}
          />
        </section>

        <Field label="Statut">
          <Segmented
            label="Statut"
            value={draft.status}
            onChange={(v) => set("status", v)}
            options={Object.entries(STATUSES) as [Draft["status"], string][]}
          />
        </Field>

        {errors.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-bad" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="sticky bottom-0 bg-bg py-3">
          <button className="btn-dark w-full" type="submit" disabled={saving} data-testid="admin-save">
            {question ? "Enregistrer" : "Créer la question"}
          </button>
        </div>
      </form>

      <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
        <p className="label">Aperçu joueur</p>
        <Preview d={draft} />
        {question && (
          <div className="rounded-2xl bg-card p-4 text-sm">
            <p className="mb-2 font-bold">Statistiques</p>
            <p className="flex justify-between">
              <span className="text-muted">Réponses</span>
              <span>{question.stats.answers}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-muted">Score moyen</span>
              <span>{question.stats.average ?? "-"}</span>
            </p>
            <p className="flex items-center justify-between">
              <span className="text-muted">Bonnes réponses</span>
              <Rate value={question.stats.success} />
            </p>
            <p className="mt-2 text-muted">
              {question.days.length ? `Planifiée : ${question.days.slice(-3).join(", ")}` : "Jamais planifiée"}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
