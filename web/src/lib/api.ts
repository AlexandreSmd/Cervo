import { auth } from "./firebase";
import type { AdminQuestion, Answer, DayDetail, DayStats, Overview, PlayedDay, Profile, Schedule, SubmitResult, Today } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string" ? detail
      : Array.isArray(detail) ? detail.map((d) => (typeof d === "string" ? d : d.msg)).join(" · ")
      : "Oups, quelque chose s'est mal passé. Réessaie dans un instant.";
    throw new ApiError(res.status, message);
  }
  return data as T;
}

const json = (body: unknown) => JSON.stringify(body);

export const api = {
  health: () => request<{ status: string; today: string; env: string }>("/health"),
  today: () => request<Today>("/today"),
  answer: (date: string, question_id: string, answer: Answer) =>
    request<SubmitResult>("/answer", { method: "POST", body: json({ date, question_id, answer }) }),
  results: (date: string) => request<DayDetail>(`/results/${date}`),
  profile: () => request<Profile>("/profile"),
  setUsername: (username: string) => request<{ username: string }>("/profile", { method: "PATCH", body: json({ username }) }),
  days: () => request<{ days: PlayedDay[] }>("/profile/days"),
  report: (question_id: string, reason: string) => request("/report", { method: "POST", body: json({ question_id, reason }) }),
  deleteAccount: () => request("/account", { method: "DELETE" }),
  admin: {
    questions: () => request<{ questions: AdminQuestion[] }>("/admin/questions"),
    reports: () => request<{ reports: { id: string; question_id: string; reason: string; created_at: string }[] }>("/admin/reports"),
    import: (questions: unknown[], overwrite = false) =>
      request<{ created: string[]; updated: string[]; errors: { index: number; errors: string[] }[] }>(
        "/admin/questions/import", { method: "POST", body: json({ questions, overwrite }) }),
    setStatus: (id: string, status: string) => request(`/admin/questions/${id}`, { method: "PATCH", body: json({ status }) }),
    update: (id: string, question: unknown) => request(`/admin/questions/${id}`, { method: "PUT", body: json(question) }),
    overview: () => request<Overview>("/admin/overview"),
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
