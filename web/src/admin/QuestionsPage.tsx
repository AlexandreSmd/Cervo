// Banque de questions : « Pas encore posées », « Déjà posées », import JSON/CSV, signalements.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import { csvToQuestions, CSV_COLUMNS } from "../lib/csv";
import type { AdminQuestion } from "../lib/types";
import { ANSWER_FORMATS, CATEGORIES, DIFFICULTIES, INPUT_FORMATS, STATUSES } from "./meta";
import { QuestionEditor } from "./QuestionEditor";
import { CategoryDot, DiffBars, Drawer, Rate, shortDate } from "./ui";

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-full px-4 py-2 text-sm font-semibold ${value === "all" ? "bg-card" : "bg-ink text-bg"}`}
    >
      <option value="all">{label}</option>
      {options.map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  );
}

/** « Pas encore posées » = la base de questions ; « Déjà posées » = l'historique (avec dates et réussite). */
export function QuestionsPage({ mode = "bank" }: { mode?: "bank" | "past" }) {
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-questions"], queryFn: api.admin.questions });
  const meta = useQuery({ queryKey: ["admin-meta-today"], queryFn: api.admin.meta, staleTime: 60_000 });
  const today = meta.data?.today ?? new Date().toISOString().slice(0, 10);
  const [search, setSearch] = useState("");
  const [f, setF] = useState({ category: "all", difficulty: "all", input: "all", answer: "all", status: "all" });
  const [editing, setEditing] = useState<AdminQuestion | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const scoped = useMemo(
    () =>
      (data?.questions ?? []).filter((q) => {
        const asked = q.days.some((d) => d <= today);
        return mode === "past" ? asked : !asked;
      }),
    [data, mode, today],
  );
  const list = useMemo(
    () =>
      scoped.filter(
        (q) =>
          (f.category === "all" || q.category === f.category) &&
          (f.difficulty === "all" || String(q.difficulty) === f.difficulty) &&
          (f.input === "all" || q.input_format === f.input) &&
          (f.answer === "all" || q.type === f.answer) &&
          (f.status === "all" || q.status === f.status) &&
          (!search || `${q.id} ${q.prompt}`.toLowerCase().includes(search.toLowerCase())),
      ),
    [scoped, f, search],
  );

  if (error) return <ErrorBox message={(error as Error).message} />;
  if (isLoading || !data) return <Loading />;
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-extrabold">{mode === "past" ? "Déjà posées" : "Pas encore posées"}</h1>
          <p className="text-sm text-muted">
            {mode === "past"
              ? `${scoped.length} questions déjà jouées, avec leur date et leur taux de réussite`
              : `${scoped.length} questions en réserve · ${scoped.filter((q) => q.days.length).length} déjà planifiées · ${scoped.filter((q) => q.status === "published" && !q.days.length).length} disponibles`}
          </p>
        </div>
        {mode === "bank" && (
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setImporting(true)}>
              Importer
            </button>
            <button className="btn-dark" onClick={() => setEditing("new")} data-testid="new-question">
              + Nouvelle question
            </button>
          </div>
        )}
      </div>
      {created && (
        <p className="chip bg-good/15 py-2" role="status" data-testid="admin-created">
          Question {created} enregistrée
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          className="input max-w-xs bg-card py-2 text-sm"
          placeholder="Rechercher"
          aria-label="Rechercher"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Filter
          label="Catégorie"
          value={f.category}
          onChange={set("category")}
          options={Object.entries(CATEGORIES).map(([k, v]) => [k, v.label])}
        />
        <Filter label="Difficulté" value={f.difficulty} onChange={set("difficulty")} options={Object.entries(DIFFICULTIES)} />
        <Filter label="Entrée" value={f.input} onChange={set("input")} options={Object.entries(INPUT_FORMATS)} />
        <Filter label="Réponse" value={f.answer} onChange={set("answer")} options={Object.entries(ANSWER_FORMATS)} />
        <Filter label="Statut" value={f.status} onChange={set("status")} options={Object.entries(STATUSES)} />
      </div>

      <div className="overflow-x-auto rounded-3xl bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3">Question</th>
              <th className="px-3 py-3">Niveau</th>
              <th className="px-3 py-3">Entrée → réponse</th>
              <th className="px-3 py-3">Bonnes rép.</th>
              <th className="px-3 py-3">{mode === "past" ? "Posée le" : "Planifiée"}</th>
              <th className="px-5 py-3">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {list.slice(0, 200).map((q) => {
              const asked = q.days.filter((d) => d <= today);
              const next = mode === "past" ? asked[asked.length - 1] : q.days.find((d) => d > today);
              return (
                <tr key={q.id} className="cursor-pointer hover:bg-ink/[0.03]" onClick={() => setEditing(q)} data-testid="admin-question">
                  <td className="max-w-lg px-5 py-3">
                    <span className="flex items-center gap-3">
                      {q.images[0] ? (
                        <img src={q.images[0].url} alt="" className="h-9 w-12 shrink-0 rounded-lg bg-bg object-cover" loading="lazy" />
                      ) : (
                        <span className="h-9 w-12 shrink-0" />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{q.prompt}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          <CategoryDot category={q.category} className="h-2 w-2" />
                          {q.category_label}
                          {q.reports > 0 && <span className="text-bad"> · ⚑ {q.reports}</span>}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <DiffBars level={q.difficulty} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">
                    {q.input_label} → {q.answer_label}
                  </td>
                  <td className="px-3 py-3">
                    <Rate value={q.stats.success} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">
                    {next ? shortDate(next) : mode === "past" ? "—" : "Non planifiée"}
                    {mode === "past" && asked.length > 1 ? ` (×${asked.length})` : ""}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`chip ${q.status === "published" ? "bg-good/15" : q.status === "draft" ? "bg-mid/20" : ""}`}>
                      {STATUSES[q.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length > 200 && (
          <p className="p-4 text-center text-sm text-muted">Affine les filtres pour voir les {list.length - 200} autres.</p>
        )}
      </div>

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Nouvelle question" : "Modifier la question"}
        wide
      >
        {editing && (
          <QuestionEditor
            key={editing === "new" ? "new" : editing.id}
            question={editing === "new" ? undefined : editing}
            onSaved={(id) => {
              setEditing(null);
              setCreated(id);
            }}
          />
        )}
      </Drawer>
      <Drawer open={importing} onClose={() => setImporting(false)} title="Importer des questions">
        <ImportBox />
      </Drawer>
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
        const d = JSON.parse(t);
        return { items: Array.isArray(d) ? d : (d.questions ?? [d]), error: null };
      }
      return { items: csvToQuestions(t), error: null };
    } catch {
      return { items: [], error: "Format non reconnu : JSON ou CSV avec en-tête." };
    }
  }, [text]);
  const submit = async () => {
    const res = await api.admin.import(parsed.items, overwrite);
    setResult(`${res.created.length} créée(s), ${res.updated.length} mise(s) à jour, ${res.errors.length} en erreur`);
    setErrors(res.errors.map((e) => `Question ${e.index + 1} : ${e.errors.join(" ; ")}`));
    await qc.invalidateQueries();
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        JSON (format de <code>content/questions</code>) ou CSV. Colonnes CSV :
      </p>
      <code className="block break-words rounded-xl bg-card p-3 text-xs">{CSV_COLUMNS.join(", ")}</code>
      <input
        type="file"
        accept=".json,.csv"
        onChange={async (e) => e.target.files?.[0] && setText(await e.target.files[0].text())}
        aria-label="Fichier"
      />
      <textarea className="input font-mono text-xs" rows={10} value={text} onChange={(e) => setText(e.target.value)} aria-label="Contenu" />
      {parsed.error ? (
        <p className="text-sm text-bad">{parsed.error}</p>
      ) : (
        parsed.items.length > 0 && <p className="text-sm">{parsed.items.length} question(s) détectée(s)</p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Remplacer les identifiants existants
      </label>
      <button className="btn-dark w-full" disabled={!parsed.items.length} onClick={submit}>
        Importer
      </button>
      {result && (
        <p className="font-semibold" role="status">
          {result}
        </p>
      )}
      {errors.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-bad">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReportsPage() {
  const reports = useQuery({ queryKey: ["admin-reports"], queryFn: api.admin.reports });
  const questions = useQuery({ queryKey: ["admin-questions"], queryFn: api.admin.questions });
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  if (!reports.data || !questions.data) return <Loading />;
  const byId = new Map(questions.data.questions.map((q) => [q.id, q]));
  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-extrabold">Signalements</h1>
      {reports.data.reports.length === 0 ? (
        <p className="rounded-3xl bg-card p-6 text-muted">Aucun signalement.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-card">
          {reports.data.reports.map((r) => {
            const q = byId.get(r.question_id);
            return (
              <li key={r.id}>
                <button className="w-full px-5 py-4 text-left hover:bg-ink/[0.03]" onClick={() => q && setEditing(q)}>
                  <p className="font-semibold">« {r.reason} »</p>
                  <p className="truncate text-sm text-muted">
                    {q?.prompt ?? r.question_id} · {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Modifier la question" wide>
        {editing && <QuestionEditor key={editing.id} question={editing} onSaved={() => setEditing(null)} />}
      </Drawer>
    </div>
  );
}
