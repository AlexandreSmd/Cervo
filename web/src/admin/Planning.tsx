import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import type { AdminQuestion, Schedule, ScheduleDay } from "../lib/types";
import { CATEGORIES, INPUT_ICON, ANSWER_ICON } from "./meta";
import { QuestionEditor } from "./QuestionEditor";
import { CategoryDot, DiffBars, Drawer, Rate, shortDate } from "./ui";

type DragData = { kind: "slot"; date: string; index: number } | { kind: "bank"; id: string };
const MIME = "application/x-cervo";

function readDrag(e: React.DragEvent): DragData | null {
  try { return JSON.parse(e.dataTransfer.getData(MIME) || e.dataTransfer.getData("text/plain")); } catch { return null; }
}

/** Calcule les journées modifiées par un glisser-déposer. */
export function applyDrop(days: Record<string, string[]>, src: DragData, date: string, index: number): Record<string, string[]> {
  const target = [...days[date]];
  if (src.kind === "bank") {
    const existing = target.indexOf(src.id);
    if (existing >= 0) [target[existing], target[index]] = [target[index], target[existing]];
    else target[index] = src.id;
    return { [date]: target };
  }
  if (src.date === date) {
    const [moved] = target.splice(src.index, 1);
    target.splice(index, 0, moved);
    return { [date]: target };
  }
  const source = [...days[src.date]];
  const a = source[src.index];
  const b = target[index];
  if (target.includes(a) || source.includes(b)) return {};
  source[src.index] = b;
  target[index] = a;
  return { [src.date]: source, [date]: target };
}

function Badge({ q, index, day, onOpen, onDrop }: { q: ScheduleDay["questions"][number]; index: number; day: ScheduleDay; onOpen: () => void; onDrop: (src: DragData) => void }) {
  const [over, setOver] = useState(false);
  const draggable = !day.locked;
  return (
    <button type="button" draggable={draggable} data-testid={`slot-${day.date}-${index}`}
      onDragStart={(e) => { const d = JSON.stringify({ kind: "slot", date: day.date, index }); e.dataTransfer.setData(MIME, d); e.dataTransfer.setData("text/plain", d); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => { if (!day.locked) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const src = readDrag(e); if (src) onDrop(src); }}
      onClick={onOpen}
      className={`group relative flex min-h-[92px] flex-col justify-between rounded-2xl p-3 text-left transition ${over ? "bg-accent/15 ring-2 ring-accent" : "bg-ink/[0.04] hover:bg-ink/[0.08]"} ${draggable ? "cursor-grab active:cursor-grabbing" : ""} ${q.status && q.status !== "published" ? "ring-2 ring-mid" : ""}`}>
      <span className="flex items-start gap-2">
        <span className="text-xs font-bold text-muted">{index + 1}</span>
        <span className="line-clamp-2 text-[13px] font-semibold leading-snug">{q.missing ? "Question supprimée" : q.prompt}</span>
      </span>
      <span className="mt-2 flex items-center justify-between gap-2 text-[10px] font-bold text-muted">
        <span className="flex items-center gap-1.5"><CategoryDot category={q.category} className="h-2 w-2" /><DiffBars level={q.difficulty} /></span>
        <span>{INPUT_ICON[q.input_format] ?? ""} → {ANSWER_ICON[q.type] ?? ""}</span>
      </span>
    </button>
  );
}

function DayCard({ day, onOpen, onDrop, onAction }: { day: ScheduleDay; onOpen: (index: number) => void; onDrop: (src: DragData, index: number) => void; onAction: (a: "regenerate" | "clear") => void }) {
  const [showWarnings, setShowWarnings] = useState(false);
  return (
    <section className={`rounded-3xl p-4 ${day.is_today ? "bg-card ring-2 ring-accent" : "bg-card"}`} aria-label={day.date} data-testid={`day-${day.date}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-display text-lg font-bold capitalize">{shortDate(day.date)}</h3>
        {day.is_today && <span className="chip bg-accent text-white">Aujourd'hui</span>}
        {day.locked && <span className="chip">🔒 {day.players} joueur{day.players > 1 ? "s" : ""}</span>}
        {day.warnings.length > 0 && (
          <button className="chip bg-mid/20" onClick={() => setShowWarnings(!showWarnings)} aria-expanded={showWarnings}>⚠ {day.warnings.length}</button>
        )}
        {!day.locked && day.planned && (
          <>
            <button className="chip hover:bg-ink/10" onClick={() => onAction("regenerate")} title="Nouvelle sélection automatique">↻ Régénérer</button>
            <button className="chip hover:bg-ink/10" onClick={() => onAction("clear")}>Vider</button>
          </>
        )}
      </div>
      {showWarnings && <ul className="mb-3 list-disc rounded-2xl bg-mid/10 py-2 pl-8 pr-3 text-sm">{day.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      {day.planned ? (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {day.questions.map((q, i) => <Badge key={`${q.id}-${i}`} q={q} index={i} day={day} onOpen={() => onOpen(i)} onDrop={(src) => onDrop(src, i)} />)}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl border-2 border-dashed border-line p-4 text-sm text-muted">
          <span>Pas encore planifié : sinon, sélection automatique le jour même.</span>
          <button className="btn-dark btn-sm" onClick={() => onAction("regenerate")}>Planifier</button>
        </div>
      )}
    </section>
  );
}

function Bank({ questions, used, onOpen }: { questions: AdminQuestion[]; used: Schedule["used"]; onOpen: (q: AdminQuestion) => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState(0);
  const [fresh, setFresh] = useState(true);
  const list = useMemo(() => questions.filter((q) =>
    q.status === "published" && (category === "all" || q.category === category) && (!difficulty || q.difficulty === difficulty) &&
    (!fresh || !(used[q.id]?.length)) && (!search || q.prompt.toLowerCase().includes(search.toLowerCase()))), [questions, used, search, category, difficulty, fresh]);
  return (
    <div className="flex h-full flex-col rounded-3xl bg-card p-4">
      <h2 className="text-lg font-bold">Banque</h2>
      <p className="mb-3 text-xs text-muted">Glisse une question sur un badge pour la remplacer.</p>
      <div className="space-y-2">
        <input className="input py-2 text-sm" placeholder="Rechercher" aria-label="Rechercher dans la banque" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-2">
          <select className="input flex-1 py-2 text-sm" aria-label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Catégories</option>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select className="input w-28 py-2 text-sm" aria-label="Difficulté" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
            <option value={0}>Niveau</option><option value={1}>Facile</option><option value={2}>Moyen</option><option value={3}>Difficile</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} /> Jamais planifiées</label>
      </div>
      <p className="mt-3 text-xs font-semibold text-muted">{list.length} questions</p>
      <ul className="mt-1 flex-1 space-y-1 overflow-y-auto pr-1" data-testid="bank">
        {list.slice(0, 150).map((q) => (
          <li key={q.id}>
            <button type="button" draggable data-testid={`bank-${q.id}`}
              onDragStart={(e) => { const d = JSON.stringify({ kind: "bank", id: q.id }); e.dataTransfer.setData(MIME, d); e.dataTransfer.setData("text/plain", d); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => onOpen(q)}
              className="flex w-full cursor-grab items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-ink/5 active:cursor-grabbing">
              <CategoryDot category={q.category} />
              <span className="flex-1 truncate">{q.prompt}</span>
              <DiffBars level={q.difficulty} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Planning() {
  const qc = useQueryClient();
  const [span, setSpan] = useState(28);
  const schedule = useQuery({ queryKey: ["admin-schedule", span], queryFn: () => api.admin.schedule(span) });
  const questions = useQuery({ queryKey: ["admin-questions"], queryFn: api.admin.questions });
  const [open, setOpen] = useState<{ date: string; index: number } | null>(null);
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (schedule.error) return <ErrorBox message={(schedule.error as Error).message} />;
  if (!schedule.data || !questions.data) return <Loading />;
  const byId = new Map(questions.data.questions.map((q) => [q.id, q]));
  const days = schedule.data.days;
  const ids = Object.fromEntries(days.filter((d) => d.planned).map((d) => [d.date, d.questions.map((q) => q.id)]));

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setMessage(label);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      await qc.invalidateQueries({ queryKey: ["admin-schedule"] });
      await qc.invalidateQueries({ queryKey: ["admin-questions"] });
      setBusy(false);
    }
  };

  const drop = (src: DragData, date: string, index: number) => {
    const changes = applyDrop(ids, src, date, index);
    if (!Object.keys(changes).length) return setMessage("Cette question est déjà dans la journée cible.");
    // Mise à jour immédiate de l'écran, puis enregistrement.
    qc.setQueryData<Schedule>(["admin-schedule", span], (old) => old && {
      ...old,
      days: old.days.map((d) => changes[d.date] ? { ...d, questions: changes[d.date].map((id) => old.days.flatMap((x) => x.questions).find((q) => q.id === id) ?? summary(byId.get(id))) } : d),
    });
    run("Planning mis à jour", () => Promise.all(Object.entries(changes).map(([d, list]) => api.admin.setDay(d, list))));
  };

  const current = open ? days.find((d) => d.date === open.date) : null;
  const currentQ = current ? byId.get(current.questions[open!.index]?.id) : undefined;

  const move = (delta: number) => {
    if (!current || !open) return;
    const target = open.index + delta;
    if (target < 0 || target > 9) return;
    drop({ kind: "slot", date: current.date, index: open.index }, current.date, target);
    setOpen({ ...open, index: target });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-4xl font-extrabold">Planning</h1>
            <p className="text-sm text-muted">Le même quiz pour tous, dans cet ordre, à minuit (heure de Paris). Glisse les badges pour réorganiser.</p>
          </div>
          <button className="btn-dark" disabled={busy} data-testid="fill" onClick={() => run("Jours vides planifiés", () => api.admin.fill(span))}>Planifier les {span} prochains jours</button>
        </div>
        {message && <p className="chip py-2" role="status">{message}</p>}
        {days.map((d) => (
          <DayCard key={d.date} day={d}
            onOpen={(index) => setOpen({ date: d.date, index })}
            onDrop={(src, index) => drop(src, d.date, index)}
            onAction={(a) => run(a === "clear" ? "Journée vidée" : "Journée planifiée", () => (a === "clear" ? api.admin.clearDay(d.date) : api.admin.regenerate(d.date)))} />
        ))}
        <button className="btn-ghost w-full" onClick={() => setSpan(span + 14)}>Afficher 2 semaines de plus</button>
      </div>
      <div className="xl:sticky xl:top-8 xl:h-[calc(100vh-4rem)]">
        <Bank questions={questions.data.questions} used={schedule.data.used} onOpen={setEditing} />
      </div>

      <Drawer open={!!open && !!currentQ} onClose={() => setOpen(null)} title={current ? `${shortDate(current.date)} · question ${open!.index + 1}` : ""}>
        {currentQ && current && (
          <div className="space-y-5">
            <p className="text-lg font-semibold">{currentQ.prompt}</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="chip"><CategoryDot category={currentQ.category} /> {currentQ.category_label}</span>
              <span className="chip">{currentQ.difficulty_label}</span>
              <span className="chip">{currentQ.input_label} → {currentQ.answer_label}</span>
            </div>
            <div className="rounded-2xl bg-card p-4 text-sm">
              <p className="flex items-center justify-between"><span className="text-muted">Bonnes réponses (toutes dates)</span><Rate value={currentQ.stats.success} /></p>
              <p className="flex justify-between"><span className="text-muted">Réponses</span><span>{currentQ.stats.answers}</span></p>
            </div>
            {!current.locked && (
              <div className="flex gap-2">
                <button className="btn-ghost btn-sm" disabled={open!.index === 0} onClick={() => move(-1)}>↑ Avant</button>
                <button className="btn-ghost btn-sm" disabled={open!.index === 9} onClick={() => move(1)}>↓ Après</button>
              </div>
            )}
            <button className="btn-dark w-full" onClick={() => { setEditing(currentQ); setOpen(null); }}>Modifier la question</button>
            {!current.locked && (
              <ReplacePicker questions={questions.data.questions} used={schedule.data.used} exclude={ids[current.date]}
                onPick={(id) => { drop({ kind: "bank", id }, current.date, open!.index); setOpen(null); }} />
            )}
          </div>
        )}
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Modifier la question" wide>
        {editing && <QuestionEditor key={editing.id} question={editing} onSaved={() => { setEditing(null); qc.invalidateQueries(); }} />}
      </Drawer>
    </div>
  );
}

function summary(q: AdminQuestion | undefined) {
  if (!q) return { id: "?", prompt: "…", type: "mcq" as const, category: "culture", category_label: "", difficulty: 1, status: "published", image: null, input_format: "text", input_label: "", answer_label: "" };
  return { id: q.id, prompt: q.prompt, type: q.type, category: q.category, category_label: q.category_label, difficulty: q.difficulty, status: q.status, image: q.images[0]?.url ?? null, input_format: q.input_format, input_label: q.input_label, answer_label: q.answer_label };
}

function ReplacePicker({ questions, used, exclude, onPick }: { questions: AdminQuestion[]; used: Schedule["used"]; exclude: string[]; onPick: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const list = questions.filter((q) => q.status === "published" && !exclude.includes(q.id) && !(used[q.id]?.length) &&
    (!search || q.prompt.toLowerCase().includes(search.toLowerCase()))).slice(0, 30);
  return (
    <div className="space-y-2">
      <p className="label">Remplacer par</p>
      <input className="input py-2 text-sm" placeholder="Rechercher une question jamais planifiée" aria-label="Rechercher une question de remplacement" value={search} onChange={(e) => setSearch(e.target.value)} />
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {list.map((q) => (
          <li key={q.id}>
            <button className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-ink/5" onClick={() => onPick(q.id)}>
              <CategoryDot category={q.category} /><span className="flex-1 truncate">{q.prompt}</span><DiffBars level={q.difficulty} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
