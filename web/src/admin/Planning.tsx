// Planning : les 10 questions de chaque jour à venir, une par type, dans l'ordre du quiz.
// Glisser-déposer : remplacer (depuis la banque, même type) ou échanger (même ligne, deux jours).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ErrorBox, Loading } from "../components/States";
import { api } from "../lib/api";
import { capitalize, formatAnswer, formatDay } from "../lib/format";
import type { AdminQuestion, QuestionSummary, Schedule, ScheduleDay } from "../lib/types";
import { KINDS, kindInfo } from "./meta";
import { applyDrop, dropRefusal, readDrag, writeDrag, type DragSource } from "./planningLogic";
import { QuestionEditor } from "./QuestionEditor";
import { DiffBars, Drawer, KindTag, Rate, shortDate } from "./ui";

/** État d'une journée, résumé en une couleur pour la frise. */
function dayTone(day: ScheduleDay): { dot: string; label: string } {
  if (!day.planned) return { dot: "bg-ink/20", label: "Vide (sélection automatique le jour même)" };
  if (day.locked) return { dot: "bg-ink", label: "Joué, verrouillé" };
  if (day.warnings.length) return { dot: "bg-mid", label: `${day.warnings.length} alerte(s)` };
  return { dot: "bg-good", label: "Prêt" };
}

/** Frise des dates : état de chaque jour d'un coup d'œil ; un clic fait défiler jusqu'au jour. */
function DateStrip({ days }: { days: ScheduleDay[] }) {
  const jump = (date: string) => document.getElementById(`day-${date}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <nav className="sticky top-0 z-20 -mx-4 bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8" aria-label="Jours">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((d) => {
          const tone = dayTone(d);
          const dt = new Date(`${d.date}T12:00:00Z`);
          return (
            <button
              key={d.date}
              onClick={() => jump(d.date)}
              title={`${shortDate(d.date)} · ${tone.label}`}
              className={`flex w-12 shrink-0 flex-col items-center rounded-2xl py-2 text-xs font-semibold transition hover:bg-card ${d.is_today ? "bg-ink text-bg hover:bg-ink" : "bg-card/60"}`}
            >
              <span className="uppercase opacity-70">
                {new Intl.DateTimeFormat("fr-FR", { weekday: "narrow", timeZone: "UTC" }).format(dt)}
              </span>
              <span className="font-display text-base font-extrabold">{dt.getUTCDate()}</span>
              <span className={`mt-1 h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-good" />
          Prêt
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-mid" />
          Alerte
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-ink/20" />
          Vide
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-ink" />
          Joué
        </span>
      </div>
    </nav>
  );
}

/** Une question du jour, en entier : énoncé, réponse attendue, catégorie, difficulté, format. */
function QuestionRow({
  q,
  index,
  day,
  onOpen,
  onDrop,
}: {
  q: QuestionSummary;
  index: number;
  day: ScheduleDay;
  onOpen: () => void;
  onDrop: (src: DragSource) => void;
}) {
  const [over, setOver] = useState(false);
  const editable = !day.locked;
  const unpublished = q.status && q.status !== "published";
  return (
    <li>
      <button
        type="button"
        draggable={editable}
        data-testid={`slot-${day.date}-${index}`}
        onDragStart={(e) => writeDrag(e, { kind: "slot", date: day.date, index })}
        onDragOver={(e) => {
          if (editable) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const src = readDrag(e);
          if (src) onDrop(src);
        }}
        onClick={onOpen}
        className={`group flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${over ? "bg-accent/15 ring-2 ring-accent" : "hover:bg-ink/[0.04]"} ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        <span className="mt-0.5 flex w-28 shrink-0 flex-col gap-0.5 text-xs">
          <span className="font-display text-base font-extrabold text-muted">{index + 1}</span>
          <KindTag category={q.category} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold leading-snug">{q.missing ? "Question supprimée" : q.prompt}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <DiffBars level={q.difficulty} />
            <span>{q.answer_label}</span>
            {unpublished && <span className="font-semibold text-mid">non publiée</span>}
          </span>
          {q.correct_answer !== undefined && (
            <span className="mt-1 block text-sm text-good">✓ {formatAnswer(q.correct_answer, q.type, q.unit)}</span>
          )}
        </span>
        {q.image && <img src={q.image} alt="" className="h-12 w-16 shrink-0 rounded-lg bg-bg object-cover" loading="lazy" />}
        {editable && (
          <span className="mt-1 hidden text-muted group-hover:block" aria-hidden="true">
            ⠿
          </span>
        )}
      </button>
    </li>
  );
}

function DaySection({
  day,
  onOpen,
  onDrop,
  onAction,
}: {
  day: ScheduleDay;
  onOpen: (index: number) => void;
  onDrop: (src: DragSource, index: number) => void;
  onAction: (a: "regenerate" | "clear") => void;
}) {
  return (
    <section
      id={`day-${day.date}`}
      className={`scroll-mt-32 rounded-3xl bg-card p-4 sm:p-5 ${day.is_today ? "ring-2 ring-accent" : ""}`}
      aria-label={day.date}
      data-testid={`day-${day.date}`}
    >
      <header className="mb-2 flex flex-wrap items-center gap-2 px-1">
        <h2 className="mr-auto text-xl font-bold">{capitalize(formatDay(day.date))}</h2>
        {day.is_today && <span className="chip bg-accent text-white">Aujourd'hui</span>}
        {day.planned && (
          <span className="chip" title="Faciles / moyennes / difficiles">
            F/M/D {day.difficulty.join("/")}
          </span>
        )}
        {day.locked && (
          <span className="chip">
            🔒 {day.players} joueur{day.players > 1 ? "s" : ""}
          </span>
        )}
        {!day.locked && day.planned && (
          <>
            <button className="chip hover:bg-ink/10" onClick={() => onAction("regenerate")} title="Nouvelle sélection automatique">
              ↻ Régénérer
            </button>
            <button className="chip hover:bg-ink/10" onClick={() => onAction("clear")}>
              Vider
            </button>
          </>
        )}
      </header>
      {day.warnings.length > 0 && (
        <p className="mx-1 mb-2 rounded-xl bg-mid/10 px-3 py-2 text-sm">
          <span aria-hidden="true">⚠ </span>
          {day.warnings.join(" · ")}
        </p>
      )}
      {day.planned ? (
        <ol className="divide-y divide-line">
          {day.questions.map((q, i) => (
            <QuestionRow key={`${q.id}-${i}`} q={q} index={i} day={day} onOpen={() => onOpen(i)} onDrop={(src) => onDrop(src, i)} />
          ))}
        </ol>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-line p-4 text-sm text-muted">
          <span>Pas encore planifié : sans action, une question de chaque type sera choisie automatiquement à minuit.</span>
          <button className="btn-dark btn-sm" onClick={() => onAction("regenerate")}>
            Planifier ce jour
          </button>
        </div>
      )}
    </section>
  );
}

/** Banque : questions publiées à glisser sur une ligne pour la remplacer. */
function Bank({ questions, used, onOpen }: { questions: AdminQuestion[]; used: Schedule["used"]; onOpen: (q: AdminQuestion) => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [difficulty, setDifficulty] = useState(0);
  const [fresh, setFresh] = useState(false);
  const list = useMemo(
    () =>
      questions.filter(
        (q) =>
          q.status === "published" &&
          !q.legacy &&
          (category === "all" || q.category === category) &&
          (!difficulty || q.difficulty === difficulty) &&
          (!fresh || !used[q.id]?.length) &&
          (!search || q.prompt.toLowerCase().includes(search.toLowerCase())),
      ),
    [questions, used, search, category, difficulty, fresh],
  );
  return (
    <div className="flex h-full flex-col rounded-3xl bg-card p-4">
      <h2 className="text-lg font-bold">Banque</h2>
      <p className="mb-3 text-xs text-muted">Glisse une question sur la ligne de son type pour la remplacer.</p>
      <div className="space-y-2">
        <input
          className="input py-2 text-sm"
          placeholder="Rechercher"
          aria-label="Rechercher dans la banque"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2">
          <select className="input flex-1 py-2 text-sm" aria-label="Type" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Tous les types</option>
            {KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.emoji} {k.label}
              </option>
            ))}
          </select>
          <select
            className="input w-28 py-2 text-sm"
            aria-label="Difficulté"
            value={difficulty}
            onChange={(e) => setDifficulty(Number(e.target.value))}
          >
            <option value={0}>Niveau</option>
            <option value={1}>Facile</option>
            <option value={2}>Moyen</option>
            <option value={3}>Difficile</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} /> Jamais posées ni planifiées
        </label>
      </div>
      <p className="mt-3 text-xs font-semibold text-muted">{list.length} questions</p>
      <ul className="mt-1 flex-1 space-y-1 overflow-y-auto pr-1" data-testid="bank">
        {list.slice(0, 150).map((q) => (
          <li key={q.id}>
            <button
              type="button"
              draggable
              data-testid={`bank-${q.id}`}
              onDragStart={(e) => writeDrag(e, { kind: "bank", id: q.id })}
              onClick={() => onOpen(q)}
              className="flex w-full cursor-grab items-start gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-ink/5 active:cursor-grabbing"
            >
              <span className="min-w-0 flex-1 leading-snug">{q.prompt}</span>
              <span className="mt-0.5 flex shrink-0 items-center gap-1.5">
                <KindTag category={q.category} short />
                <DiffBars level={q.difficulty} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Remplacer la question d'une ligne : les autres questions publiées du même type, les moins récentes d'abord. */
function ReplacePicker({
  questions,
  used,
  category,
  exclude,
  onPick,
}: {
  questions: AdminQuestion[];
  used: Schedule["used"];
  category: string;
  exclude: string[];
  onPick: (id: string) => void;
}) {
  const last = (id: string) => (used[id]?.length ? used[id][used[id].length - 1] : "");
  const list = questions
    .filter((q) => q.status === "published" && q.category === category && !exclude.includes(q.id))
    .sort((a, b) => last(a.id).localeCompare(last(b.id)));
  const info = kindInfo(category);
  return (
    <div className="space-y-2">
      <p className="label">
        Remplacer par une autre question {info.emoji} {info.label}
      </p>
      {list.length === 0 && <p className="text-sm text-muted">Aucune autre question de ce type : crée-en une dans la banque.</p>}
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {list.map((q) => (
          <li key={q.id}>
            <button
              className="flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left text-sm hover:bg-ink/5"
              onClick={() => onPick(q.id)}
            >
              <span className="flex-1">{q.prompt}</span>
              <span className="shrink-0 text-xs text-muted">{last(q.id) ? shortDate(last(q.id)) : "jamais"}</span>
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
  const empty = days.filter((d) => !d.planned).length;

  /** Lance une action serveur, affiche le résultat, puis rafraîchit planning et banque. */
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

  const kindOf = (id: string) => byId.get(id)?.category ?? days.flatMap((d) => d.questions).find((q) => q.id === id)?.category;
  const drop = (src: DragSource, date: string, index: number) => {
    const changes = applyDrop(ids, src, date, index, kindOf);
    if (!Object.keys(changes).length) return setMessage(dropRefusal(ids, src, date, index, kindOf));
    // Affichage immédiat (optimiste), puis enregistrement des journées touchées.
    const all = new Map(days.flatMap((d) => d.questions).map((q) => [q.id, q]));
    qc.setQueryData<Schedule>(
      ["admin-schedule", span],
      (old) =>
        old && {
          ...old,
          days: old.days.map((d) =>
            changes[d.date] ? { ...d, questions: changes[d.date].map((id) => all.get(id) ?? summary(byId.get(id))) } : d,
          ),
        },
    );
    run("Planning mis à jour", () => Promise.all(Object.entries(changes).map(([d, list]) => api.admin.setDay(d, list))));
  };

  const current = open ? days.find((d) => d.date === open.date) : null;
  const currentQ = current && open ? byId.get(current.questions[open.index]?.id) : undefined;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-4xl font-extrabold">Planning</h1>
            <p className="text-sm text-muted">
              Même quiz pour tous à minuit (heure de Paris) : une question de chaque type, toujours dans cet ordre.
            </p>
          </div>
          <button
            className="btn-dark"
            disabled={busy}
            data-testid="fill"
            onClick={() => run("Jours vides planifiés", () => api.admin.fill(span))}
          >
            {empty ? `Planifier les ${empty} jours vides` : "Tout est planifié"}
          </button>
        </div>
        <DateStrip days={days} />
        {message && (
          <p className="chip py-2" role="status">
            {message}
          </p>
        )}
        {days.map((d) => (
          <DaySection
            key={d.date}
            day={d}
            onOpen={(index) => setOpen({ date: d.date, index })}
            onDrop={(src, index) => drop(src, d.date, index)}
            onAction={(a) =>
              run(a === "clear" ? "Journée vidée" : "Journée planifiée", () =>
                a === "clear" ? api.admin.clearDay(d.date) : api.admin.regenerate(d.date),
              )
            }
          />
        ))}
        <button className="btn-ghost w-full" onClick={() => setSpan(span + 14)}>
          Afficher 2 semaines de plus
        </button>
      </div>
      <div className="xl:sticky xl:top-8 xl:h-[calc(100vh-4rem)]">
        <Bank questions={questions.data.questions} used={schedule.data.used} onOpen={setEditing} />
      </div>

      <Drawer
        open={!!currentQ}
        onClose={() => setOpen(null)}
        title={current && open && currentQ ? `${shortDate(current.date)} · ${open.index + 1}. ${kindInfo(currentQ.category).label}` : ""}
      >
        {currentQ && current && open && (
          <div className="space-y-5">
            <p className="text-lg font-semibold">{currentQ.prompt}</p>
            <p className="text-good">✓ {formatAnswer(currentQ.correct_answer, currentQ.type, currentQ.numeric_config?.unit)}</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="chip">
                <KindTag category={currentQ.category} />
              </span>
              <span className="chip">{currentQ.difficulty_label}</span>
              <span className="chip">{currentQ.answer_label}</span>
            </div>
            <div className="rounded-2xl bg-card p-4 text-sm">
              <p className="flex items-center justify-between">
                <span className="text-muted">Bonnes réponses (toutes dates)</span>
                <Rate value={currentQ.stats.success} />
              </p>
              <p className="flex justify-between">
                <span className="text-muted">Réponses</span>
                <span>{currentQ.stats.answers}</span>
              </p>
            </div>
            <button
              className="btn-dark w-full"
              onClick={() => {
                setEditing(currentQ);
                setOpen(null);
              }}
            >
              Modifier la question
            </button>
            {!current.locked && (
              <ReplacePicker
                questions={questions.data.questions}
                used={schedule.data.used}
                category={currentQ.category}
                exclude={ids[current.date]}
                onPick={(id) => {
                  drop({ kind: "bank", id }, current.date, open.index);
                  setOpen(null);
                }}
              />
            )}
          </div>
        )}
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Modifier la question" wide>
        {editing && (
          <QuestionEditor
            key={editing.id}
            question={editing}
            onSaved={() => {
              setEditing(null);
              qc.invalidateQueries();
            }}
          />
        )}
      </Drawer>
    </div>
  );
}

/** Résumé local d'une question de la banque (pour l'affichage optimiste après un dépôt). */
function summary(q: AdminQuestion | undefined): QuestionSummary {
  if (!q)
    return {
      id: "?",
      prompt: "…",
      type: "mcq",
      category: "",
      category_label: "",
      difficulty: 1,
      status: "published",
      image: null,
      input_format: "text",
      input_label: "",
      answer_label: "",
    };
  return {
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    category: q.category,
    category_label: q.category_label,
    difficulty: q.difficulty,
    status: q.status,
    image: q.images[0]?.url ?? null,
    input_format: q.input_format,
    input_label: q.input_label,
    answer_label: q.answer_label,
    correct_answer: q.correct_answer,
    unit: q.numeric_config?.unit,
    memorize: !!q.memorize,
    emoji: q.emoji,
  };
}
