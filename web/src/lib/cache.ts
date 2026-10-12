// Dernières réponses de l'API gardées sur l'appareil : à la réouverture, l'écran s'affiche
// tout de suite avec ces données, puis se met à jour dès que l'API a répondu.
// Uniquement de l'affichage : le jeu lui-même attend toujours les données fraîches du serveur.

const KEY = "vif-cache-v1";

interface Stored {
  uid: string;
  entries: Record<string, unknown>;
}

function load(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

/** Donnée gardée pour ce joueur (ou pour le dernier joueur de l'appareil tant que la session s'ouvre). */
export function readCached<T>(name: string, uid: string | undefined): T | undefined {
  const stored = load();
  if (!stored || (uid && stored.uid !== uid)) return undefined;
  return stored.entries[name] as T | undefined;
}

export function writeCached(name: string, uid: string, data: unknown): void {
  try {
    const stored = load();
    const entries = stored?.uid === uid ? stored.entries : {};
    localStorage.setItem(KEY, JSON.stringify({ uid, entries: { ...entries, [name]: data } }));
  } catch {
    // stockage plein ou interdit (navigation privée) : on s'en passe
  }
}

/** Oublie tout si un autre joueur ouvre une session sur cet appareil. */
export function forgetOtherUsers(uid: string): void {
  const stored = load();
  if (stored && stored.uid !== uid) {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // rien à faire
    }
  }
}

/** Date du jour du quiz (AAAA-MM-JJ, heure de Paris), comme côté serveur. */
export function quizDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
