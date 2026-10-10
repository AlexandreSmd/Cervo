import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AnswerInput } from "../components/AnswerInput";
import { QuestionHeader } from "../components/QuestionCard";
import { api } from "../lib/api";
import { formatAnswer } from "../lib/format";
import type { AdminQuestion, ImageRef, QuestionType } from "../lib/types";
import { ANSWER_FORMATS, CATEGORIES, DIFFICULTIES, INPUT_FORMATS, STATUSES, TEMPLATES, type InputFormat, type Template } from "./meta";
import { Rate, Segmented } from "./ui";

interface Form {
  input: InputFormat;
  images: ImageRef[];
  type: QuestionType;
  category: string;
  difficulty: number;
  prompt: string;
  choices: string[];
  correct: string;
  scale: "linear" | "log";
  tolerance: string;
  factor: string;
  unit: string;
  margin: string;
  aliases: string;
  explanation: string;
  source_url: string;
  status: "published" | "draft" | "retired";
}

const EMPTY_IMAGE: ImageRef = { url: "", alt: "", credit: "" };
const IMAGE_COUNT: Record<InputFormat, number> = { text: 0, image: 1, images2: 2 };

function fromQuestion(q: AdminQuestion): Form {
  const cfg = q.numeric_config ?? { scale: "linear" as const };
  return {
    input: q.images.length >= 2 ? "images2" : q.images.length === 1 ? "image" : "text",
    images: q.images.map((i) => ({ url: i.url, alt: i.alt, credit: i.credit ?? "" })),
    type: q.type, category: q.category, difficulty: q.difficulty, prompt: q.prompt,
    choices: q.choices?.length === 4 ? [...q.choices] : ["", "", "", ""],
    correct: q.type === "binary" ? String(q.correct_answer) : String(q.correct_answer ?? ""),
    scale: cfg.scale, tolerance: cfg.tolerance ? String(cfg.tolerance) : "", factor: cfg.factor ? String(cfg.factor) : "3",
    unit: cfg.unit ?? "", margin: cfg.exact_margin ? String(cfg.exact_margin) : "",
    aliases: (q.accepted_aliases ?? []).join(" | "), explanation: q.explanation ?? "", source_url: q.source_url ?? "", status: q.status,
  };
}

function fromTemplate(t: Template): Form {
  return {
    input: t.input, images: Array.from({ length: IMAGE_COUNT[t.input] }, () => ({ ...EMPTY_IMAGE })), type: t.type, category: t.category,
    difficulty: 2, prompt: t.prompt ?? "", choices: t.choices ? [...t.choices] : ["", "", "", ""], correct: "", scale: t.type === "numeric" && t.input !== "text" ? "log" : "linear",
    tolerance: "", factor: "3", unit: "", margin: "", aliases: "", explanation: "", source_url: "", status: "published",
  };
}

function toPayload(f: Form): Record<string, unknown> {
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));
  const q: Record<string, unknown> = {
    type: f.type, category: f.category, difficulty: f.difficulty, prompt: f.prompt.trim(), explanation: f.explanation.trim(), status: f.status,
    images: f.images.slice(0, IMAGE_COUNT[f.input]).map((i) => ({ url: i.url.trim(), alt: i.alt.trim() || "Photo", credit: i.credit?.trim() || undefined })),
  };
  if (f.type === "binary") q.correct_answer = f.correct === "true";
  if (f.type === "mcq") { q.choices = f.choices.map((c) => c.trim()); q.correct_answer = f.correct; }
  if (f.type === "numeric") {
    q.correct_answer = num(f.correct);
    q.numeric_config = f.scale === "log"
      ? { scale: "log", factor: num(f.factor) ?? 3, unit: f.unit || undefined, exact_margin: num(f.margin) }
      : { scale: "linear", tolerance: num(f.tolerance), unit: f.unit || undefined, exact_margin: num(f.margin) };
  }
  if (f.type === "short_text") {
    q.correct_answer = /^-?\d+([.,]\d+)?$/.test(f.correct.trim()) ? num(f.correct) : f.correct.trim();
    q.accepted_aliases = f.aliases.split("|").map((a) => a.trim()).filter(Boolean);
  }
  if (f.source_url.trim()) q.source_url = f.source_url.trim();
  return q;
}

/** Réduit une photo (1200 px max, JPEG) avant l'envoi. */
async function compress(file: File): Promise<string> {
  if (file.type === "image/svg+xml") {
    return new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file); });
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function ImageSlot({ index, image, onChange, labelled }: { index: number; image: ImageRef; onChange: (i: ImageRef) => void; labelled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.admin.uploadMedia(await compress(file));
      onChange({ ...image, url });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const name = labelled ? `Photo ${String.fromCharCode(65 + index)}` : "Photo";
  return (
    <div className="space-y-2 rounded-2xl bg-ink/5 p-3">
      <div className="flex items-center gap-3">
        <label className="relative flex h-20 w-28 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-card text-xs font-semibold text-muted hover:ring-2 hover:ring-accent">
          {image.url ? <img src={image.url} alt="" className="h-full w-full object-cover" /> : busy ? "Envoi…" : "+ Photo"}
          <input type="file" accept="image/*" className="sr-only" aria-label={`${name} : choisir un fichier`} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        <div className="flex-1 space-y-2">
          <input className="input py-2 text-sm" placeholder={`${name} : URL (ou envoie un fichier)`} aria-label={`${name} : URL`} value={image.url} onChange={(e) => onChange({ ...image, url: e.target.value })} required />
          <input className="input py-2 text-sm" placeholder="Description (accessibilité)" aria-label={`${name} : description`} value={image.alt} onChange={(e) => onChange({ ...image, alt: e.target.value })} required />
        </div>
      </div>
      <input className="input py-2 text-sm" placeholder="Crédit (auteur, licence)" aria-label={`${name} : crédit`} value={image.credit ?? ""} onChange={(e) => onChange({ ...image, credit: e.target.value })} />
      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}

export function QuestionEditor({ question, onSaved }: { question?: AdminQuestion; onSaved: (id: string) => void }) {
  const [form, setForm] = useState<Form | null>(question ? fromQuestion(question) : null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  if (!form) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">Choisis un modèle : il fixe ce que voit le joueur (entrée) et ce qu'il répond (réponse). Tout reste modifiable.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <button key={t.key} className="rounded-2xl bg-card p-4 text-left transition hover:ring-2 hover:ring-accent" onClick={() => setForm(fromTemplate(t))} data-testid={`template-${t.key}`}>
              <span className="block font-bold">{t.title}</span>
              <span className="text-sm text-muted">{t.hint}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((s) => (s ? { ...s, [k]: v } : s));
  const setInput = (input: InputFormat) => setForm((s) => {
    if (!s) return s;
    const images = [...s.images];
    while (images.length < IMAGE_COUNT[input]) images.push({ ...EMPTY_IMAGE });
    return { ...s, input, images };
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setSaving(true);
    try {
      const payload = toPayload(form);
      let id = question?.id;
      if (question) {
        await api.admin.update(question.id, payload);
      } else {
        const res = await api.admin.import([payload]);
        if (res.errors.length) { setErrors(res.errors[0].errors); return; }
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

  const preview = {
    id: "apercu", type: form.type, choices: form.type === "mcq" ? form.choices.map((c, i) => c || `Choix ${i + 1}`) : null, unit: form.unit || null,
    category_label: CATEGORIES[form.category].label, pillar: CATEGORIES[form.category].pillar, difficulty: form.difficulty,
    prompt: form.prompt || "Ta question apparaîtra ici", images: form.images.slice(0, IMAGE_COUNT[form.input]).filter((i) => i.url),
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <form onSubmit={save} className="space-y-5" aria-label="Question">
        <section className="space-y-3">
          <p className="label">1 · Ce que voit le joueur</p>
          <Segmented label="Format d'entrée" value={form.input} onChange={setInput} options={Object.entries(INPUT_FORMATS) as [InputFormat, string][]} />
          <textarea id="q-prompt" className="input text-base" rows={2} placeholder="La question" aria-label="Question" value={form.prompt} onChange={(e) => set("prompt", e.target.value)} required minLength={5} />
          {form.images.slice(0, IMAGE_COUNT[form.input]).map((img, i) => (
            <ImageSlot key={i} index={i} image={img} labelled={form.input === "images2"} onChange={(next) => set("images", form.images.map((x, j) => (j === i ? next : x)))} />
          ))}
        </section>

        <section className="space-y-3">
          <p className="label">2 · Ce qu'il répond</p>
          <Segmented label="Format de réponse" value={form.type} onChange={(t) => setForm({ ...form, type: t, correct: "" })} options={Object.entries(ANSWER_FORMATS) as [QuestionType, string][]} />
          {form.type === "binary" && (
            <Segmented label="Bonne réponse" value={form.correct} onChange={(v) => set("correct", v)} options={[["true", "Vrai"], ["false", "Faux"]]} />
          )}
          {form.type === "mcq" && (
            <div className="space-y-2">
              {form.choices.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="radio" name="correct" className="h-5 w-5 accent-[rgb(var(--accent))]" aria-label={`Choix ${i + 1} correct`} checked={!!c && form.correct === c} onChange={() => set("correct", c)} required />
                  <input className="input py-2 text-base" aria-label={`Choix ${i + 1}`} placeholder={`Choix ${i + 1}`} value={c} required
                    onChange={(e) => { const next = [...form.choices]; const was = form.correct === c; next[i] = e.target.value; setForm({ ...form, choices: next, correct: was ? e.target.value : form.correct }); }} />
                </div>
              ))}
              <p className="text-xs text-muted">Coche la bonne réponse. L'ordre est mélangé pour le joueur.</p>
            </div>
          )}
          {form.type === "numeric" && (
            <div className="grid grid-cols-2 gap-2">
              <input id="q-num" className="input py-2 text-base" inputMode="decimal" placeholder="Bonne réponse" aria-label="Bonne réponse" value={form.correct} onChange={(e) => set("correct", e.target.value)} required />
              <input className="input py-2 text-base" placeholder="Unité (m, km, %…)" aria-label="Unité" value={form.unit} onChange={(e) => set("unit", e.target.value)} />
              <div className="col-span-2"><Segmented label="Échelle" value={form.scale} onChange={(v) => set("scale", v)} options={[["linear", "Écart absolu (années, %)"], ["log", "En proportion (grandeurs)"]]} /></div>
              {form.scale === "linear"
                ? <input className="input py-2 text-base" placeholder="0 point au-delà de ± …" aria-label="Tolérance" value={form.tolerance} onChange={(e) => set("tolerance", e.target.value)} required />
                : <input className="input py-2 text-base" placeholder="0 point au-delà d'un facteur …" aria-label="Facteur" value={form.factor} onChange={(e) => set("factor", e.target.value)} required />}
              <input className="input py-2 text-base" placeholder="100 points à ± … près" aria-label="Marge exacte" value={form.margin} onChange={(e) => set("margin", e.target.value)} />
            </div>
          )}
          {form.type === "short_text" && (
            <div className="space-y-2">
              <input id="q-short" className="input py-2 text-base" placeholder="Bonne réponse" aria-label="Bonne réponse" value={form.correct} onChange={(e) => set("correct", e.target.value)} required />
              <input className="input py-2 text-base" placeholder="Autres réponses acceptées, séparées par |" aria-label="Autres réponses acceptées" value={form.aliases} onChange={(e) => set("aliases", e.target.value)} />
              <p className="text-xs text-muted">Majuscules, accents et ponctuation sont ignorés.</p>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <p className="label">3 · Classement</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <select id="q-cat" className="input py-2.5 text-base" aria-label="Catégorie" value={form.category} onChange={(e) => set("category", e.target.value)}>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <Segmented label="Difficulté" value={form.difficulty} onChange={(v) => set("difficulty", v)} options={Object.entries(DIFFICULTIES).map(([k, v]) => [Number(k), v])} />
          </div>
        </section>

        <section className="space-y-3">
          <p className="label">4 · Après la réponse</p>
          <textarea id="q-expl" className="input text-base" rows={3} placeholder="Explication (« le saviez-vous »)" aria-label="Explication" value={form.explanation} onChange={(e) => set("explanation", e.target.value)} required minLength={10} />
          <input className="input py-2 text-base" placeholder="Source (URL)" aria-label="Source" value={form.source_url} onChange={(e) => set("source_url", e.target.value)} />
        </section>

        <section className="space-y-3">
          <p className="label">5 · Statut</p>
          <Segmented label="Statut" value={form.status} onChange={(v) => set("status", v)} options={Object.entries(STATUSES) as [Form["status"], string][]} />
        </section>

        {errors.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-bad" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <div className="sticky bottom-0 flex gap-2 bg-bg py-3">
          {!question && <button type="button" className="btn-ghost" onClick={() => setForm(null)}>Modèles</button>}
          <button className="btn-dark flex-1" type="submit" disabled={saving} data-testid="admin-save">{question ? "Enregistrer" : "Créer la question"}</button>
        </div>
      </form>

      <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
        <p className="label">Aperçu joueur</p>
        <div className="rounded-[32px] border-8 border-ink/90 bg-bg p-3">
          <div className="card space-y-4 p-4">
            <QuestionHeader question={preview} />
            <AnswerInput question={preview} disabled onSubmit={() => undefined} />
          </div>
        </div>
        {form.correct && <p className="text-sm text-muted">Bonne réponse : <strong className="text-ink">{formatAnswer(form.type === "binary" ? form.correct === "true" : form.correct, form.type, form.unit)}</strong></p>}
        {question && (
          <div className="rounded-2xl bg-card p-4 text-sm">
            <p className="mb-2 font-bold">Statistiques</p>
            <p className="flex justify-between"><span className="text-muted">Réponses</span><span>{question.stats.answers}</span></p>
            <p className="flex justify-between"><span className="text-muted">Score moyen</span><span>{question.stats.average ?? "—"}</span></p>
            <p className="flex items-center justify-between"><span className="text-muted">Bonnes réponses</span><Rate value={question.stats.success} /></p>
            <p className="mt-2 text-muted">{question.days.length ? `Planifiée : ${question.days.slice(-3).join(", ")}` : "Jamais planifiée"}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
