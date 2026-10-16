// Requêtes du joueur (TanStack Query), activées une fois la session prête.
// Accueil et profil s'affichent aussitôt avec les dernières données connues (lib/cache.ts).
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import { quizDay, readCached, writeCached } from "./cache";
import type { Leaderboard, PlayedDay, Profile, Today } from "./types";

/** Garde sur l'appareil la dernière version fraîche reçue (y compris après une réponse au quiz). */
function usePersist<T>(name: string, uid: string | undefined, query: UseQueryResult<T>) {
  const { data, isPlaceholderData } = query;
  useEffect(() => {
    if (uid && data !== undefined && !isPlaceholderData) writeCached(name, uid, data);
  }, [name, uid, data, isPlaceholderData]);
}

export function useToday() {
  const { user, ready } = useAuth();
  const query = useQuery({
    queryKey: ["today", user?.uid],
    queryFn: api.today,
    enabled: ready && !!user,
    // Appli restée ouverte en arrière-plan (téléphone) : au retour, on vérifie l'état du jour (nouveau quiz à minuit).
    refetchOnWindowFocus: true,
    // Le quiz d'hier ne sert à rien : seulement celui du jour.
    placeholderData: () => {
      const cached = readCached<Today>("today", user?.uid);
      return cached?.date === quizDay() ? cached : undefined;
    },
  });
  usePersist("today", user?.uid, query);
  return query;
}

export function useProfile() {
  const { user, ready } = useAuth();
  const query = useQuery({
    queryKey: ["profile", user?.uid],
    queryFn: api.profile,
    enabled: ready && !!user,
    placeholderData: () => readCached<Profile>("profile", user?.uid),
  });
  usePersist("profile", user?.uid, query);
  return query;
}

export function useDays() {
  const { user, ready } = useAuth();
  const query = useQuery({
    queryKey: ["days", user?.uid],
    queryFn: api.days,
    enabled: ready && !!user,
    placeholderData: () => readCached<{ days: PlayedDay[] }>("days", user?.uid),
  });
  usePersist("days", user?.uid, query);
  return query;
}

export function useLeaderboard() {
  const { user, ready } = useAuth();
  const query = useQuery({
    queryKey: ["leaderboard", user?.uid],
    queryFn: api.leaderboard,
    enabled: ready && !!user,
    placeholderData: () => readCached<Leaderboard>("leaderboard", user?.uid),
  });
  usePersist("leaderboard", user?.uid, query);
  return query;
}

export function useResults(date: string) {
  const { user, ready } = useAuth();
  return useQuery({ queryKey: ["results", user?.uid, date], queryFn: () => api.results(date), enabled: ready && !!user, retry: false });
}
