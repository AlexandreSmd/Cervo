// Client de l'API : ajoute le jeton Firebase, traduit les erreurs en messages lisibles.
import { auth } from "./firebase";
import type {
  AdminQuestion,
  Answer,
  DayDetail,
  DayStats,
  Leaderboard,
  Overview,
  PlayedDay,
  Profile,
  Schedule,
  SubmitResult,
  Today,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Une requête bloquée (réseau mobile capricieux) échoue au lieu de laisser l'écran en attente.
const TIMEOUT_MS = 20_000;
const NETWORK_ERROR = "Connexion impossible. Vérifie ton réseau, puis réessaie.";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  let text: string;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {}),
      },
    });
    text = await res.text();
  } catch {
    throw new ApiError(0, NETWORK_ERROR); // hors ligne, délai dépassé, connexion coupée
  } finally {
    window.clearTimeout(timer);
  }
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // réponse non JSON (page d'erreur d'un intermédiaire) : traitée comme une erreur serveur
  }
  if (!res.ok || (text && data === null)) {
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => (typeof d === "string" ? d : d.msg)).join(" · ")
          : "Oups, quelque chose s'est mal passé. Réessaie dans un instant.";
    throw new ApiError(res.ok ? 502 : res.status, message);
  }
  return data as T;
}

/** Vaut-il la peine de réessayer ? Oui pour le réseau et les erreurs serveur, jamais pour un refus. */
export function isTransient(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  health: () => request<{ status: string; today: string; env: string }>("/health"),
  today: () => request<Today>("/today"),
  startQuestion: (date: string, question_id: string) =>
    request<{ started_at: string; server_time: string; position: number }>("/question-start", {
      method: "POST",
      body: json({ date, question_id }),
    }),
  clue: (date: string, question_id: string) =>
    request<{ clues: string[]; clue_total: number }>("/clue", { method: "POST", body: json({ date, question_id }) }),
  answer: (date: string, question_id: string, answer: Answer | null) =>
    request<SubmitResult>("/answer", { method: "POST", body: json({ date, question_id, answer }) }),
  results: (date: string) => request<DayDetail>(`/results/${date}`),
  profile: () => request<Profile>("/profile"),
  setUsername: (username: string) => request<{ username: string }>("/profile", { method: "PATCH", body: json({ username }) }),
  days: () => request<{ days: PlayedDay[] }>("/profile/days"),
  leaderboard: () => request<Leaderboard>("/leaderboard"),
  report: (question_id: string, reason: string) => request("/report", { method: "POST", body: json({ question_id, reason }) }),
  deleteAccount: () => request("/account", { method: "DELETE" }),
  admin: {
    questions: () => request<{ questions: AdminQuestion[] }>("/admin/questions"),
    reports: () => request<{ reports: { id: string; question_id: string; reason: string; created_at: string }[] }>("/admin/reports"),
    import: (questions: unknown[], overwrite = false) =>
      request<{ created: string[]; updated: string[]; errors: { index: number; errors: string[] }[] }>("/admin/questions/import", {
        method: "POST",
        body: json({ questions, overwrite }),
      }),
    /** Supprime à jamais et remplace la question aujourd'hui et dans les jours planifiés. */
    remove: (id: string) =>
      request<{ id: string; erased: boolean; replaced: Record<string, string | null> }>(`/admin/questions/${id}`, { method: "DELETE" }),
    setStatus: (id: string, status: string) => request(`/admin/questions/${id}`, { method: "PATCH", body: json({ status }) }),
    update: (id: string, question: unknown) => request(`/admin/questions/${id}`, { method: "PUT", body: json(question) }),
    overview: () => request<Overview>("/admin/overview"),
    meta: () => request<{ today: string }>("/admin/meta"),
    dayStats: (date: string) => request<DayStats>(`/admin/stats/${date}`),
    schedule: (days = 28, start?: string) => request<Schedule>(`/admin/schedule?days=${days}${start ? `&start=${start}` : ""}`),
    fill: (days = 28) => request<{ created: string[] }>("/admin/schedule/fill", { method: "POST", body: json({ days }) }),
    setDay: (date: string, question_ids: string[]) => request(`/admin/schedule/${date}`, { method: "PUT", body: json({ question_ids }) }),
    regenerate: (date: string) => request<{ question_ids: string[] }>(`/admin/schedule/${date}/regenerate`, { method: "POST" }),
    clearDay: (date: string) => request(`/admin/schedule/${date}`, { method: "DELETE" }),
    uploadMedia: (data_url: string) => request<{ url: string }>("/admin/media", { method: "POST", body: json({ data_url }) }),
  },
  dev: {
    login: (role: "demo" | "admin") => request<{ token: string; email: string }>("/dev/login", { method: "POST", body: json({ role }) }),
    replayToday: () => request("/dev/replay-today", { method: "POST" }),
    seedHistory: () => request<{ created: number }>("/dev/seed-history", { method: "POST" }),
    simulatePlayers: () => request<{ players: number }>("/dev/simulate-players", { method: "POST" }),
  },
};
