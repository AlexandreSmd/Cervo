import { auth } from "./firebase";
import type { AdminQuestion, Answer, DayDetail, PlayedDay, Profile, SubmitResult, Today } from "./types";

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
    const message = typeof detail === "string" ? detail : "Oups, quelque chose s'est mal passé. Réessaie dans un instant.";
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
  },
  dev: {
    login: (role: "demo" | "admin") => request<{ token: string; email: string }>("/dev/login", { method: "POST", body: json({ role }) }),
    replayToday: () => request("/dev/replay-today", { method: "POST" }),
    seedHistory: () => request<{ created: number }>("/dev/seed-history", { method: "POST" }),
  },
};
