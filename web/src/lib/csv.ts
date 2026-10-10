// Import CSV de l'admin : une ligne = une question. Les listes sont séparées par « | ».
export const CSV_COLUMNS = [
  "id", "type", "category", "difficulty", "prompt", "choices", "correct_answer", "scale", "tolerance", "factor",
  "unit", "exact_margin", "accepted_aliases", "explanation", "source_url", "image_url", "image_alt", "image_credit", "tags", "status",
];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const delimiter = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const list = (v: string) => v.split("|").map((s) => s.trim()).filter(Boolean);
const num = (v: string) => (v.trim() === "" ? undefined : Number(v.replace(",", ".")));

export function csvToQuestions(text: string): Record<string, unknown>[] {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ""));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return rows.map((cells) => {
    const r: Record<string, string> = {};
    keys.forEach((k, i) => { r[k] = (cells[i] ?? "").trim(); });
    const type = r.type;
    let correct: unknown = r.correct_answer;
    if (type === "binary") correct = ["vrai", "true", "oui", "1"].includes(r.correct_answer.toLowerCase());
    else if (type === "numeric") correct = num(r.correct_answer);
    else if (type === "short_text" && /^-?\d+([.,]\d+)?$/.test(r.correct_answer)) correct = num(r.correct_answer);
    const q: Record<string, unknown> = {
      type, category: r.category, difficulty: Number(r.difficulty || 2), prompt: r.prompt,
      correct_answer: correct, explanation: r.explanation, status: r.status || "draft",
    };
    if (r.id) q.id = r.id;
    if (r.choices) q.choices = list(r.choices);
    if (r.accepted_aliases) q.accepted_aliases = list(r.accepted_aliases);
    if (r.tags) q.tags = list(r.tags);
    for (const k of ["source_url", "image_url", "image_alt", "image_credit"]) if (r[k]) q[k] = r[k];
    if (type === "numeric") {
      q.numeric_config = {
        scale: r.scale === "log" ? "log" : "linear",
        tolerance: num(r.tolerance ?? ""), factor: num(r.factor ?? ""), unit: r.unit || undefined, exact_margin: num(r.exact_margin ?? ""),
      };
    }
    return q;
  });
}
