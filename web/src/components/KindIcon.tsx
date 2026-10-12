// Icônes des 10 types : un trait simple, dessiné pour Vif (24 × 24, trait de 2).
const PATHS: Record<string, string> = {
  // un livre ouvert
  vocabulaire: "M3 5.5h6a3 3 0 0 1 3 3V20a2.5 2.5 0 0 0-2.5-2.5H3z M21 5.5h-6a3 3 0 0 0-3 3V20a2.5 2.5 0 0 1 2.5-2.5H21z",
  // deux carrés, le petit dans le coin du grand
  taille: "M3 21v-7h7v7z M10 21h11V3H3v11",
  // une ampoule
  fait: "M9.5 18h5 M10.5 21h3 M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2V16h5v-.1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z",
  // quatre cartes retournées, une visible
  memoire: "M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z M15.5 16.5h2",
  // le signe pour cent
  stat: "M19 5 5 19 M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  // une frise avec trois repères
  chronologie: "M3 12h18 M6 8v8 M12 6v12 M18 9v6",
  // une balance
  estimation: "M12 4v16 M8 20h8 M5 7h14 M5 7l-3 6a3 3 0 0 0 6 0z M19 7l-3 6a3 3 0 0 0 6 0z",
  // une loupe
  devinette: "M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20.5 20.5l-5-5",
  // un point d'interrogation dans un cercle
  enigme: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.4 9.3a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 4 M12 17.6h.01",
  // une plume qui écrit
  dictee: "M4 20h16 M5 16l10.5-10.5a2.1 2.1 0 0 1 3 3L8 19H5z",
};

// Anciennes questions (avant les 10 types) : un simple point.
const FALLBACK = "M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z";

export function KindIcon({ kind, className = "h-4 w-4" }: { kind: string; className?: string }) {
  const d = PATHS[kind] ?? FALLBACK;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
