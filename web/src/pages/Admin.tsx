import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnswerInput } from "../components/AnswerInput";
import { CategoryTag } from "../components/CategoryTag";
import { QuestionImage } from "../components/QuestionImage";
import { ErrorBox, Loading } from "../components/States";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { csvToQuestions, CSV_COLUMNS } from "../lib/csv";
import { formatAnswer } from "../lib/format";
import type { PublicQuestion, QuestionType } from "../lib/types";

const CATEGORIES: Record<string, [string, string]> = {
  culture: ["Culture générale", "memoire"], logique: ["Logique", "raisonnement"], reflexion: ["Réflexion", "raisonnement"],
  geographie: ["Géographie", "estimation"], histoire: ["Histoire", "memoire"], sciences: ["Sciences", "estimation"],
  nature: ["Nature et animaux", "memoire"], arts: ["Arts et culture", "memoire"], sport: ["Sport", "memoire"],
  estimation: ["Estimation", "estimation"], vrai_faux: ["Vrai ou faux", "esprit_critique"],
};
const STATUS_LABEL = { draft: "Brouillon", published: "Publiée", retired: "Retirée" } as const;
const TYPE_LABEL: Record<QuestionType, string> = { binary: "Vrai/faux", mcq: "QCM", numeric: "Numérique", short_text: "Réponse courte" };

type Tab = "list" | "form" | "import" | "reports";

export function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("list");
  const questions = useQuery({ queryKey: ["admin-questions", user?.uid], queryFn: api.admin.questions, enabled: !!user, retry: false });

  if (questions.error instanceof ApiError && (questions.error.status === 403 || questions.error.status === 401)) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <h1 className="text-2xl font-extrabold">Espace réservé</h1>
        <p className="text-muted">Cette page est réservée aux comptes administrateurs (variable ADMIN_EMAILS).</p>
        <Link to="/connexion" className="btn-primary">Se connecter</Link>
      </div>
    );
  }
  if (questions.error) return <ErrorBox message={(questions.error as Error).message} />;
  if (!questions.data) return <Loading />;

  const tabs: [Tab, string][] = [["list", "Questions"], ["form", "Ajouter"], ["import", "Importer"], ["reports", "Signalements"]];
  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-extrabold">Admin</h1>
      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-card p-1" role="tablist">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${tab === key ? "bg-accent text-white" : "text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "list" && <QuestionList items={questions.data.questions} />}
      {tab === "form" && <QuestionForm onDone={() => setTab("list")} />}
      {tab === "import" && <ImportBox />}
      {tab === "reports" && <Reports />}
    </div>
  );
}

function QuestionList({ items }: { items: Awaited<ReturnType<typeof api.admin.questions>>["questions"] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const qc = useQueryClient();
  const filtered = useMemo(() => items.filter((q) =>
    (status === "all" || q.status === status) && (category === "all" || q.category === category) &&
    (!search || `${q.id} ${q.prompt}`.toLowerCase().includes(search.toLowerCase()))), [items, search, status, category]);
  const counts = useMemo(() => items.reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.status]: (acc[q.status] ?? 0) + 1 }), {}), [items]);

  const change = async (id: string, next: string) => {
    await api.admin.setStatus(id, next);
    await qc.invalidateQueries({ queryKey: ["admin-questions"] });
  };

  return (
    <section className="space-y-3">
      <p className="text-sm text-muted">{items.length} questions · {counts.published ?? 0} publiées · {counts.draft ?? 0} brouillons · {counts.retired ?? 0} retirées</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="input py-2 text-base" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Rechercher" />
        <select className="input py-2 text-base" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Statut">
          <option value="all">Tous les statuts</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input py-2 text-base" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Catégorie">
          <option value="all">Toutes les catégories</option>
          {Object.entries(CATEGORIES).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      <ul className="space-y-2">
        {filtered.slice(0, 100).map((q) => (
          <li key={q.id} className="card space-y-2 p-4 text-sm" data-testid="admin-question">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>{q.id} · {TYPE_LABEL[q.type]} · {CATEGORIES[q.category]?.[0]} · difficulté {q.difficulty}</span>
              <span className={`rounded-full px-2 py-0.5 font-bold ${q.status === "published" ? "bg-good/15 text-good" : q.status === "draft" ? "bg-mid/20 text-ink" : "bg-line text-muted"}`}>{STATUS_LABEL[q.status]}</span>
            </div>
            <p className="font-semibold">{q.prompt}</p>
            <p className="text-muted">Réponse : {formatAnswer(q.correct_answer, q.type)}{q.reports > 0 && <span className="ml-2 font-bold text-bad">⚑ {q.reports} signalement{q.reports > 1 ? "s" : ""}</span>}</p>
            <div className="flex gap-2">
              {q.status !== "published" && <button className="btn-soft px-3 py-1.5 text-xs" onClick={() => change(q.id, "published")}>Publier</button>}
              {q.status !== "retired" && <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => change(q.id, "retired")}>Retirer</button>}
              {q.status !== "draft" && <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => change(q.id, "draft")}>Brouillon</button>}
            </div>
          </li>
        ))}
      </ul>
      {filtered.length > 100 && <p className="text-center text-sm text-muted">Affinez la recherche pour voir les {filtered.length - 100} autres.</p>}
    </section>
  );
}

interface FormState {
  type: QuestionType; category: string; difficulty: number; prompt: string; choices: string[]; correct: string;
  scale: "linear" | "log"; tolerance: string; factor: string; unit: string; aliases: string; explanation: string;
  source_url: string; image_url: string; image_alt: string; status: "draft" | "published";
}

const EMPTY: FormState = {
  type: "mcq", category: "culture", difficulty: 1, prompt: "", choices: ["", "", "", ""], correct: "", scale: "linear",
  tolerance: "", factor: "3", unit: "", aliases: "", explanation: "", source_url: "", image_url: "", image_alt: "", status: "published",
};

function toPayload(f: FormState): Record<string, unknown> {
  const q: Record<string, unknown> = {
    type: f.type, category: f.category, difficulty: f.difficulty, prompt: f.prompt.trim(), explanation: f.explanation.trim(), status: f.status,
  };
  if (f.type === "binary") q.correct_answer = f.correct === "true";
  if (f.type === "mcq") { q.choices = f.choices.map((c) => c.trim()); q.correct_answer = f.correct; }
  if (f.type === "numeric") {
    q.correct_answer = Number(f.correct.replace(",", "."));
    q.numeric_config = f.scale === "log"
      ? { scale: "log", factor: Number(f.factor) || 3, unit: f.unit || undefined }
      : { scale: "linear", tolerance: Number(f.tolerance) || undefined, unit: f.unit || undefined };
  }
  if (f.type === "short_text") {
    q.correct_answer = /^-?\d+([.,]\d+)?$/.test(f.correct.trim()) ? Number(f.correct.replace(",", ".")) : f.correct.trim();
    q.accepted_aliases = f.aliases.split("|").map((a) => a.trim()).filter(Boolean);
  }
  if (f.source_url) q.source_url = f.source_url.trim();
  if (f.image_url) { q.image_url = f.image_url.trim(); q.image_alt = f.image_alt.trim(); }
  return q;
}

function QuestionForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const qc = useQueryClient();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const preview: PublicQuestion = {
    id: "apercu", position: 0, type: f.type, category: f.category, category_label: CATEGORIES[f.category][0], pillar: CATEGORIES[f.category][1],
    difficulty: f.difficulty, prompt: f.prompt || "L'énoncé de ta question apparaîtra ici.", image_url: f.image_url || null,
    image_alt: f.image_alt || null, image_credit: null, choices: f.type === "mcq" ? f.choices.map((c, i) => c || `Choix ${i + 1}`) : null, unit: f.unit || null,
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    const res = await api.admin.import([toPayload(f)]).catch((err: Error) => ({ created: [], updated: [], errors: [{ index: 0, errors: [err.message] }] }));
    if (res.errors.length) { setErrors(res.errors[0].errors); return; }
    setDone(res.created[0]);
    setF(EMPTY);
    await qc.invalidateQueries({ queryKey: ["admin-questions"] });
  };

  return (
    <div className="space-y-5">
      {done && (
        <div className="rounded-2xl bg-good/10 p-4 text-sm" role="status" data-testid="admin-created">
          Question <strong>{done}</strong> enregistrée. <button className="link" onClick={onDone}>Voir la liste</button>
        </div>
      )}
      <form onSubmit={save} className="card space-y-4 p-5" aria-label="Nouvelle question">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="q-type">Type</label>
            <select id="q-type" className="input py-2 text-base" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as QuestionType, correct: "" })}>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="q-cat">Catégorie</label>
            <select id="q-cat" className="input py-2 text-base" value={f.category} onChange={(e) => set("category", e.target.value)}>
              {Object.entries(CATEGORIES).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="q-diff">Difficulté</label>
            <select id="q-diff" className="input py-2 text-base" value={f.difficulty} onChange={(e) => set("difficulty", Number(e.target.value))}>
              <option value={1}>1 · Facile</option><option value={2}>2 · Moyen</option><option value={3}>3 · Difficile</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="q-status">Statut</label>
            <select id="q-status" className="input py-2 text-base" value={f.status} onChange={(e) => set("status", e.target.value as FormState["status"])}>
              <option value="published">Publiée</option><option value="draft">Brouillon</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor="q-prompt">Énoncé</label>
          <textarea id="q-prompt" className="input text-base" rows={2} value={f.prompt} onChange={(e) => set("prompt", e.target.value)} required minLength={5} />
        </div>
        {f.type === "binary" && (
          <div>
            <label className="label" htmlFor="q-bin">Bonne réponse</label>
            <select id="q-bin" className="input py-2 text-base" value={f.correct} onChange={(e) => set("correct", e.target.value)} required>
              <option value="">Choisir…</option><option value="true">Vrai</option><option value="false">Faux</option>
            </select>
          </div>
        )}
        {f.type === "mcq" && (
          <fieldset className="space-y-2">
            <legend className="label">Choix (coche la bonne réponse)</legend>
            {f.choices.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" aria-label={`Choix ${i + 1} correct`} checked={!!c && f.correct === c} onChange={() => set("correct", c)} required />
                <input className="input py-2 text-base" aria-label={`Choix ${i + 1}`} value={c} required
                  onChange={(e) => { const next = [...f.choices]; const wasCorrect = f.correct === c; next[i] = e.target.value; setF({ ...f, choices: next, correct: wasCorrect ? e.target.value : f.correct }); }} />
              </div>
            ))}
          </fieldset>
        )}
        {f.type === "numeric" && (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="q-num">Bonne réponse</label><input id="q-num" className="input py-2 text-base" inputMode="decimal" value={f.correct} onChange={(e) => set("correct", e.target.value)} required /></div>
            <div><label className="label" htmlFor="q-unit">Unité</label><input id="q-unit" className="input py-2 text-base" value={f.unit} onChange={(e) => set("unit", e.target.value)} placeholder="m, km, %…" /></div>
            <div>
              <label className="label" htmlFor="q-scale">Échelle</label>
              <select id="q-scale" className="input py-2 text-base" value={f.scale} onChange={(e) => set("scale", e.target.value as FormState["scale"])}>
                <option value="linear">Linéaire (années, %)</option><option value="log">Logarithmique (grandeurs)</option>
              </select>
            </div>
            {f.scale === "linear"
              ? <div><label className="label" htmlFor="q-tol">Tolérance (0 point au-delà)</label><input id="q-tol" className="input py-2 text-base" value={f.tolerance} onChange={(e) => set("tolerance", e.target.value)} required /></div>
              : <div><label className="label" htmlFor="q-fac">Facteur (0 point au-delà)</label><input id="q-fac" className="input py-2 text-base" value={f.factor} onChange={(e) => set("factor", e.target.value)} required /></div>}
          </div>
        )}
        {f.type === "short_text" && (
          <div className="grid gap-3">
            <div><label className="label" htmlFor="q-short">Bonne réponse</label><input id="q-short" className="input py-2 text-base" value={f.correct} onChange={(e) => set("correct", e.target.value)} required /></div>
            <div><label className="label" htmlFor="q-alias">Autres réponses acceptées (séparées par |)</label><input id="q-alias" className="input py-2 text-base" value={f.aliases} onChange={(e) => set("aliases", e.target.value)} /></div>
          </div>
        )}
        <div>
          <label className="label" htmlFor="q-expl">Explication (« le saviez-vous »)</label>
          <textarea id="q-expl" className="input text-base" rows={2} value={f.explanation} onChange={(e) => set("explanation", e.target.value)} required minLength={10} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="q-src">Source (URL)</label><input id="q-src" className="input py-2 text-base" value={f.source_url} onChange={(e) => set("source_url", e.target.value)} /></div>
          <div><label className="label" htmlFor="q-img">Image (ex. /questions/points-37.svg)</label><input id="q-img" className="input py-2 text-base" value={f.image_url} onChange={(e) => set("image_url", e.target.value)} /></div>
          {f.image_url && <div className="sm:col-span-2"><label className="label" htmlFor="q-alt">Texte alternatif de l'image</label><input id="q-alt" className="input py-2 text-base" value={f.image_alt} onChange={(e) => set("image_alt", e.target.value)} required /></div>}
        </div>
        {errors.length > 0 && <ul className="list-disc pl-5 text-sm text-bad" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <button className="btn-primary w-full" type="submit" data-testid="admin-save">Enregistrer la question</button>
      </form>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Aperçu joueur</h2>
        <div className="card space-y-4 p-5">
          <CategoryTag label={preview.category_label} pillar={preview.pillar} />
          <p className="font-display text-xl font-bold">{preview.prompt}</p>
          {preview.image_url && <QuestionImage src={preview.image_url} alt={preview.image_alt} credit={null} />}
          <AnswerInput question={preview} disabled onSubmit={() => undefined} />
          {f.correct && <p className="text-sm text-muted">Bonne réponse : {formatAnswer(f.type === "binary" ? f.correct === "true" : f.correct, f.type, f.unit)}</p>}
        </div>
      </section>
    </div>
  );
}

function ImportBox() {
  const [text, setText] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const qc = useQueryClient();

  const parsed = useMemo(() => {
    const t = text.trim();
    if (!t) return { items: [] as unknown[], error: null as string | null };
    try {
      if (t.startsWith("[") || t.startsWith("{")) {
        const data = JSON.parse(t);
        return { items: Array.isArray(data) ? data : data.questions ?? [data], error: null };
      }
      return { items: csvToQuestions(t), error: null };
    } catch {
      return { items: [], error: "Format non reconnu : colle un tableau JSON ou un CSV avec une ligne d'en-tête." };
    }
  }, [text]);

  const onFile = async (file: File) => setText(await file.text());

  const submit = async () => {
    setResult(null);
    setErrors([]);
    const res = await api.admin.import(parsed.items, overwrite);
    setResult(`${res.created.length} créée(s), ${res.updated.length} mise(s) à jour, ${res.errors.length} en erreur.`);
    setErrors(res.errors.map((e) => `Question ${e.index + 1} : ${e.errors.join(" ; ")}`));
    await qc.invalidateQueries({ queryKey: ["admin-questions"] });
  };

  return (
    <section className="card space-y-4 p-5">
      <p className="text-sm text-muted">
        Colle un tableau JSON (format de <code>content/questions/*.json</code>) ou un CSV avec ces colonnes :
        <code className="mt-1 block break-words text-xs">{CSV_COLUMNS.join(", ")}</code>
        Les listes (choix, alias, tags) sont séparées par « | ».
      </p>
      <input type="file" accept=".json,.csv,application/json,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} aria-label="Fichier JSON ou CSV" />
      <textarea className="input font-mono text-xs" rows={10} value={text} onChange={(e) => setText(e.target.value)} aria-label="Contenu à importer" placeholder='[{"type": "binary", "category": "vrai_faux", ...}]' />
      {parsed.error ? <p className="text-sm text-bad">{parsed.error}</p> : parsed.items.length > 0 && <p className="text-sm">Aperçu : {parsed.items.length} question(s) détectée(s).</p>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Remplacer les questions qui ont le même identifiant</label>
      <button className="btn-primary w-full" disabled={!parsed.items.length} onClick={submit}>Importer</button>
      {result && <p className="font-semibold" role="status">{result}</p>}
      {errors.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-bad">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </section>
  );
}

function Reports() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["admin-reports", user?.uid], queryFn: api.admin.reports });
  if (isLoading || !data) return <Loading />;
  if (!data.reports.length) return <p className="card p-5 text-muted">Aucun signalement pour l'instant.</p>;
  return (
    <ul className="space-y-2">
      {data.reports.map((r) => (
        <li key={r.id} className="card p-4 text-sm">
          <p className="text-xs text-muted">{r.question_id} · {new Date(r.created_at).toLocaleString("fr-FR")}</p>
          <p>{r.reason}</p>
        </li>
      ))}
    </ul>
  );
}
