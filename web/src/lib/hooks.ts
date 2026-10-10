// Requêtes du joueur (TanStack Query), activées une fois la session prête.
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";

export function useToday() {
  const { user, ready } = useAuth();
  return useQuery({ queryKey: ["today", user?.uid], queryFn: api.today, enabled: ready && !!user });
}

export function useProfile() {
  const { user, ready } = useAuth();
  return useQuery({ queryKey: ["profile", user?.uid], queryFn: api.profile, enabled: ready && !!user });
}

export function useDays() {
  const { user, ready } = useAuth();
  return useQuery({ queryKey: ["days", user?.uid], queryFn: api.days, enabled: ready && !!user });
}

export function useResults(date: string) {
  const { user, ready } = useAuth();
  return useQuery({ queryKey: ["results", user?.uid, date], queryFn: () => api.results(date), enabled: ready && !!user, retry: false });
}
