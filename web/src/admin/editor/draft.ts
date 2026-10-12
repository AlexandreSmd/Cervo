// Brouillon de l'éditeur : un formulaire simple (textes) ↔ une question au format de l'API.
// Logique pure, testée sans navigateur (draft.test.ts).
import type { AdminQuestion, ImageRef, QuestionType, SizeConfig } from "../../lib/types";
import { KIND_RULES } from "../meta";

export interface Draft {
  category: string;
  type: QuestionType;
  difficulty: number;
  status: "published" | "draft" | "retired";
  prompt: string;
  images: ImageRef[];
  /** QCM : les 4 choix ; `correct` : le choix juste. */
  choices: string[];
  /** Bonne réponse saisie en texte (choix, nombre, mot, dictée…). */
  correct: string;
  aliases: string;
  /** Classement : éléments dans le bon ordre, et leur précision (date) pour la chronologie. */
  items: string[];
  details: string[];
  /** Mémoire : éléments montrés (un par ligne), durée (vide = calculée), photos cachées aussi. */
  memItems: string;
  memSeconds: string;
  memHideImages: boolean;
  recallOrdered: boolean;
  clues: string[];
  unit: string;
  /** Estimation : facteur d'erreur à 0 point (1,5 strict, 2 normal, 3 large). */
  factor: string;
  margin: string;
  /** Pourcentage : écart en points à 0 point. */
  tolerance: string;
  size: SizeConfig;
  explanation: string;
  sourceUrl: string;
  /** Chrono imposé (vide = calculé). */
  timeLimit: string;
}

const EMPTY_SIZE: SizeConfig = { reference: { label: "", emoji: "" }, target: { label: "", emoji: "" }, min: 0.1, max: 10 };

export function newDraft(category: string): Draft {
  const rules = KIND_RULES[category];
  return {
    category,
    type: rules.answerTypes[0],
    difficulty: 2,
    status: "published",
    prompt: rules.prompt,
    images: [],
    choices: ["", "", "", ""],
    correct: category === "fait" ? "true" : "",
    aliases: "",
    items: ["", "", "", ""],
    details: ["", "", "", ""],
    memItems: "",
    memSeconds: "",
    memHideImages: false,
    recallOrdered: true,
    clues: ["", "", "", ""],
    unit: "",
    factor: "2",
    margin: "",
    tolerance: "",
    size: structuredClone(EMPTY_SIZE),
    explanation: "",
    sourceUrl: "",
    timeLimit: "",
  };
}

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function fromQuestion(q: AdminQuestion): Draft {
  const base = newDraft(q.category in KIND_RULES ? q.category : "enigme");
  const cfg = q.numeric_config ?? null;
  const list = Array.isArray(q.correct_answer) ? q.correct_answer.map(String) : [];
  return {
    ...base,
    category: q.category,
    type: q.type,
    difficulty: q.difficulty,
    status: q.status,
    prompt: q.prompt,
    images: q.images.map((i) => ({ url: i.url, alt: i.alt, credit: i.credit ?? "" })),
    choices: q.choices?.length === 4 ? [...q.choices] : base.choices,
    correct: Array.isArray(q.correct_answer) ? "" : text(q.correct_answer),
    aliases: (q.accepted_aliases ?? []).join(" | "),
    items: q.type === "order" ? list : base.items,
    details: q.order_details ? [...q.order_details] : list.map(() => ""),
    memItems: (q.memorize?.items ?? []).join("\n"),
    memSeconds: text(q.memorize?.seconds),
    memHideImages: !!q.memorize?.hide_images,
    recallOrdered: q.recall_ordered ?? true,
    clues: q.clues?.length ? [...q.clues] : base.clues,
    unit: cfg?.unit ?? "",
    factor: text(cfg?.factor ?? 2),
    margin: text(cfg?.exact_margin),
    tolerance: text(cfg?.tolerance),
    size: q.size_config ? structuredClone(q.size_config) : base.size,
    explanation: q.explanation ?? "",
    sourceUrl: q.source_url ?? "",
    timeLimit: text(q.time_limit),
  };
}

/** Nombre saisi (« 3,5 » ou « 3.5 ») ; undefined si vide ou invalide. */
export function num(v: string): number | undefined {
  const cleaned = v.replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

const lines = (v: string) =>
  v
    .split(/\n|,/)
    .map((i) => i.trim())
    .filter(Boolean);

const filled = (values: string[]) => values.map((v) => v.trim()).filter(Boolean);

export function memorizedItems(d: Draft): string[] {
  return lines(d.memItems);
}

/** La question au format de l'API (validée côté serveur). */
export function toPayload(d: Draft): Record<string, unknown> {
  const q: Record<string, unknown> = {
    category: d.category,
    type: d.type,
    difficulty: d.difficulty,
    status: d.status,
    prompt: d.prompt.trim(),
    explanation: d.explanation.trim(),
    images: d.images
      .filter((i) => i.url.trim())
      .map((i) => ({ url: i.url.trim(), alt: i.alt.trim() || "Photo", credit: i.credit?.trim() || undefined })),
  };
  if (d.sourceUrl.trim()) q.source_url = d.sourceUrl.trim();
  if (d.timeLimit.trim()) q.time_limit = num(d.timeLimit);

  if (d.category === "memoire") {
    q.memorize = { items: memorizedItems(d), seconds: num(d.memSeconds), hide_images: d.memHideImages };
  }

  switch (d.type) {
    case "binary":
      q.correct_answer = d.correct === "true";
      break;
    case "mcq":
      q.choices = d.choices.map((c) => c.trim());
      q.correct_answer = d.correct.trim();
      break;
    case "short_text": {
      const n = num(d.correct);
      q.correct_answer = /^-?\d+([.,]\d+)?$/.test(d.correct.trim()) && n !== undefined ? n : d.correct.trim();
      q.accepted_aliases = filled(d.aliases.split("|"));
      break;
    }
    case "riddle":
      q.correct_answer = d.correct.trim();
      q.accepted_aliases = filled(d.aliases.split("|"));
      q.clues = filled(d.clues);
      break;
    case "numeric":
      q.correct_answer = num(d.correct);
      q.numeric_config = { scale: "log", factor: num(d.factor) ?? 2, unit: d.unit.trim() || undefined, exact_margin: num(d.margin) };
      break;
    case "percent":
      q.correct_answer = num(d.correct);
      if (num(d.tolerance)) q.numeric_config = { tolerance: num(d.tolerance) };
      break;
    case "size":
      q.correct_answer = num(d.correct);
      q.size_config = d.size;
      break;
    case "dictation":
      q.correct_answer = d.correct.trim().replace(/\s+/g, " ");
      break;
    case "recall":
      q.correct_answer = memorizedItems(d);
      q.recall_ordered = d.recallOrdered;
      break;
    case "order": {
      if (d.category === "memoire") {
        q.correct_answer = memorizedItems(d);
      } else {
        const rows = d.items.map((item, i) => [item.trim(), (d.details[i] ?? "").trim()]).filter(([item]) => item);
        q.correct_answer = rows.map(([item]) => item);
        q.order_details = rows.map(([, detail]) => detail);
      }
      break;
    }
  }
  return q;
}
