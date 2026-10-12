// Banque de questions : couverture des 10 types, « Pas encore posées », « Déjà posées », import, signalements.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import { csvToQuestions, CSV_COLUMNS } from "../lib/csv";
import type { AdminQuestion } from "../lib/types";
import { DIFFICULTIES, KINDS, STATUSES } from "./meta";
import { DeleteQuestionButton } from "./DeleteButton";
import { QuestionEditor } from "./QuestionEditor";
import { DiffBars, Drawer, KindTag, Rate, shortDate } from "./ui";

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
  const [f, setF] = useState({ category: "all", difficulty: "all", status: "all" });
  const [legacy, setLegacy] = useState(false);
  const [editing, setEditing] = useState<AdminQuestion | { kind?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const scoped = useMemo(
    () =>
      (data?.questions ?? []).filter((q) => {
        if (q.legacy !== legacy) return false;
        const asked = q.days.some((d) => d <= today);
        return mode === "past" ? asked : !asked;
      }),
    [data, mode, today, legacy],
  );
  const list = useMemo(
    () =>
      scoped.filter(
        (q) =>
          (f.category === "all" || q.category === f.category) &&
          (f.difficulty === "all" || String(q.difficulty) === f.difficulty) &&
          (f.status === "all" || q.status === f.status) &&
          (!search || `${q.id} ${q.prompt}`.toLowerCase().includes(search.toLowerCase())),
      ),
    [scoped, f, search],
  );

  if (error) return <ErrorBox message={(error as Error).message} />;
  if (isLoading || !data) return <Loading />;
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const legacyCount = data.questions.filter((q) => q.legacy).length;

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
            <button className="btn-dark" onClick={() => setEditing({})} data-testid="new-question">
              + Nouvelle question
            </button>
          </div>
        )}
      </div>
      {created && (
        <p className="chip bg-good/15 py-2" role="status" data-testid="admin-created">
          {created.includes(" ") ? created : `Question ${created} enregistrée`}
        </p>
      )}

      {mode === "bank" && !legacy && <Coverage questions={data.questions} today={today} onAdd={(kind) => setEditing({ kind })} />}

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Type de question">
        {[{ key: "all", label: "Tous", emoji: "" }, ...KINDS].map((k) => (
          <button
            key={k.key}
            role="tab"
            aria-selected={f.category === k.key}
            onClick={() => set("category")(k.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${f.category === k.key ? "bg-ink text-bg" : "bg-card"}`}
          >
            {k.emoji ? `${k.emoji} ` : ""}
            {k.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs bg-card py-2 text-sm"
          placeholder="Rechercher"
          aria-label="Rechercher"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Filter label="Difficulté" value={f.difficulty} onChange={set("difficulty")} options={Object.entries(DIFFICULTIES)} />
        <Filter label="Statut" value={f.status} onChange={set("status")} options={Object.entries(STATUSES)} />
        {legacyCount > 0 && (
          <label className="ml-auto flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={legacy} onChange={(e) => setLegacy(e.target.checked)} /> Anciennes questions ({legacyCount})
          </label>
        )}
      </div>

      <div className="overflow-x-auto rounded-3xl bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3">Question</th>
              <th className="px-3 py-3">Niveau</th>
              <th className="px-3 py-3">Mécanique</th>
              <th className="px-3 py-3">Bonnes rép.</th>
              <th className="px-3 py-3">{mode === "past" ? "Posée le" : "Planifiée"}</th>
              <th className="px-5 py-3">Statut</th>
              <th className="py-3 pr-3" aria-label="Supprimer" />
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
                        <span className="flex items-center gap-1.5 text-xs">
                          <KindTag category={q.category} />
                          {q.reports > 0 && <span className="text-bad"> · ⚑ {q.reports}</span>}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <DiffBars level={q.difficulty} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">
                    {q.answer_label}
                    {q.images.length ? " · photo" : ""}
                  </td>
                  <td className="px-3 py-3">
                    <Rate value={q.stats.success} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">
                    {next ? shortDate(next) : mode === "past" ? "-" : "Non planifiée"}
                    {mode === "past" && asked.length > 1 ? ` (×${asked.length})` : ""}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`chip ${q.status === "published" ? "bg-good/15" : q.status === "draft" ? "bg-mid/20" : ""}`}>
                      {STATUSES[q.status as keyof typeof STATUSES] ?? q.status}
                    </span>
                  </td>
                  <td className="py-3 pr-3">{!q.legacy && <DeleteQuestionButton id={q.id} onDone={setCreated} />}</td>
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
        title={editing && "id" in editing ? "Modifier la question" : "Nouvelle question"}
        wide
      >
        {editing && (
          <QuestionEditor
            key={"id" in editing ? editing.id : `new-${editing.kind ?? ""}`}
            question={"id" in editing ? (editing as AdminQuestion) : undefined}
            initialKind={"id" in editing ? undefined : (editing as { kind?: string }).kind}
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

/** Couverture de la banque : pour chaque type, les questions prêtes et combien de jours elles couvrent. */
function Coverage({ questions, today, onAdd }: { questions: AdminQuestion[]; today: string; onAdd: (kind: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="coverage">
      {KINDS.map((k) => {
        const mine = questions.filter((q) => q.category === k.key && q.status === "published");
        const fresh = mine.filter((q) => !q.days.some((d) => d <= today)).length;
        const levels = [1, 2, 3].map((d) => mine.filter((q) => q.difficulty === d).length);
        const low = mine.length < 7;
        return (
          <div key={k.key} className="flex flex-col gap-1 rounded-2xl bg-card p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">
                {k.emoji} {k.label}
              </span>
              <button
                className="chip px-2 py-0.5"
                onClick={() => onAdd(k.key)}
                aria-label={`Ajouter une question ${k.label}`}
                data-testid={`add-${k.key}`}
              >
                +
              </button>
            </div>
            <span className={`font-display text-2xl font-extrabold ${low ? "text-mid" : ""}`}>{mine.length}</span>
            <span className="text-xs text-muted">
              {fresh} jamais posée{fresh > 1 ? "s" : ""} · F/M/D {levels.join("/")}
            </span>
            <span className={`text-xs ${low ? "font-semibold text-mid" : "text-muted"}`}>
              {mine.length ? `revient tous les ${mine.length} j` : "aucune question"}
            </span>
          </div>
        );
      })}
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
