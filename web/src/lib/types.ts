// Contrats de l'API (miroir des réponses de api/cervo/web/*).
export type QuestionType = "binary" | "mcq" | "numeric" | "short_text" | "order" | "size" | "dictation" | "recall" | "percent" | "riddle";
export type Answer = string | number | boolean | string[];

export interface ImageRef {
  url: string;
  alt: string;
  credit?: string | null;
}

export interface PublicQuestion {
  id: string;
  position: number;
  type: QuestionType;
  /** Type de question parmi les 10 (vocabulaire, taille…). */
  category: string;
  category_label: string;
  emoji: string;
  /** Consigne courte du type (« Ajuste la taille »). */
  instruction: string | null;
  pillar: string;
  difficulty: number;
  prompt: string;
  images: ImageRef[];
  choices: string[] | null;
  unit: string | null;
  /** Chrono en secondes ; null : sans chrono (dictée). */
  time_limit: number | null;
  memorize?: Memorize | null;
  items?: string[];
  size?: SizeConfig;
  slider?: { min: number; max: number; step: number };
  speech?: string;
  /** Devinette : indices déjà dévoilés, et nombre total d'indices. */
  clues?: string[];
  clue_total?: number;
  recall?: { count: number; ordered: boolean; single_chars: boolean };
}

export interface Memorize {
  items: string[];
  seconds: number | null;
  hide_images?: boolean;
}

export interface SizeConfig {
  reference: { label: string; emoji: string };
  target: { label: string; emoji: string };
  min: number;
  max: number;
}

export interface Reveal {
  correct_answer: Answer;
  explanation: string | null;
  source_url: string | null;
  /** Classement : précision de chaque élément (date…), dans l'ordre attendu. */
  order_details?: string[];
  /** Devinette : tous les indices. */
  clues?: string[];
  size?: SizeConfig;
}

export interface AnswerResult extends Reveal {
  question_id: string;
  position: number;
  user_answer: Answer | null;
  score: number;
  timed_out?: boolean;
  /** Devinette : indices vus au moment de répondre. */
  clues_seen?: number;
}

export interface Today {
  date: string;
  questions: PublicQuestion[];
  answers: AnswerResult[];
  completed: boolean;
  score_total: number | null;
  streak: number;
  username: string;
  is_admin: boolean;
  server_time: string;
  current: { position: number; question_id: string; started_at: string } | null;
}

/** Les joueurs du jour sur une question (null tant qu'ils sont trop peu). */
export interface QuestionCommunity {
  players: number;
  /** Part des joueurs qui ont tout bon (%). */
  success: number;
  average: number;
}

export interface SubmitResult extends AnswerResult {
  community?: QuestionCommunity | null;
  completed: boolean;
  score_total: number | null;
  streak: number;
}

export interface DayItem extends PublicQuestion, Reveal {
  community?: QuestionCommunity | null;
  question_id: string;
  user_answer: Answer | null;
  score: number;
}

export interface DayDetail {
  date: string;
  score_total: number;
  /** Ta place parmi les joueurs du jour (null tant qu'ils sont trop peu). */
  community: { players: number; average: number; percentile: number | null } | null;
  completed_at: string;
  items: DayItem[];
}

export interface Profile {
  uid: string;
  username: string;
  email: string | null;
  is_anonymous: boolean;
  is_admin: boolean;
  created_at: string;
  today: string;
  days_played: number;
  average: number | null;
  current_streak: number;
  best_streak: number;
  last_30_days: { date: string; score: number | null }[];
  best_day: { date: string; score: number } | null;
  worst_day: { date: string; score: number } | null;
  correct_rate: number | null;
  numeric_precision: number | null;
  categories: { category: string; label: string; emoji: string; average: number | null; count: number }[];
  pillars: { pillar: string; label: string; average: number | null; count: number; trend: number | null }[];
}

export interface PastAnswer {
  question_id: string;
  position: number;
  user_answer: Answer | null;
  score: number;
  category: string;
  type: QuestionType;
  prompt: string | null;
  correct_answer: Answer | null;
  unit: string | null;
}

export interface PlayedDay {
  date: string;
  score_total: number;
  answers: PastAnswer[];
}

export interface RateStats {
  answers: number;
  average: number | null;
  success: number | null;
}

export interface NumericConfig {
  scale: "linear" | "log";
  tolerance?: number | null;
  factor?: number | null;
  unit?: string | null;
  exact_margin?: number | null;
  input?: "keyboard" | "slider";
  min?: number | null;
  max?: number | null;
  step?: number | null;
}

export interface QuestionDoc {
  id: string;
  type: QuestionType;
  category: string;
  tags?: string[];
  difficulty: number;
  prompt: string;
  images: ImageRef[];
  choices?: string[] | null;
  correct_answer: Answer;
  numeric_config?: NumericConfig | null;
  accepted_aliases?: string[];
  size_config?: SizeConfig | null;
  memorize?: Memorize | null;
  clues?: string[];
  order_details?: string[] | null;
  recall_ordered?: boolean;
  time_limit?: number | null;
  explanation: string;
  source_url?: string | null;
  status: "draft" | "published" | "retired";
  created_at?: string;
}

export interface AdminQuestion extends QuestionDoc {
  input_format: "text" | "image" | "images2";
  input_label: string;
  answer_label: string;
  difficulty_label: string;
  category_label: string;
  emoji: string;
  /** Ancienne question, d'avant les 10 types (lecture seule). */
  legacy: boolean;
  computed_time_limit: number | null;
  computed_memorize_seconds: number | null;
  reports: number;
  stats: RateStats;
  days: string[];
}

export interface QuestionSummary {
  id: string;
  prompt: string;
  type: QuestionType;
  category: string;
  category_label: string;
  difficulty: number;
  status: string;
  image: string | null;
  input_format: string;
  input_label: string;
  answer_label: string;
  correct_answer?: Answer;
  unit?: string | null;
  memorize?: boolean;
  order_details?: string[] | null;
  emoji?: string;
  legacy?: boolean;
  missing?: boolean;
}

export interface ScheduleDay {
  date: string;
  planned: boolean;
  locked: boolean;
  is_today: boolean;
  players: number;
  questions: QuestionSummary[];
  warnings: string[];
  /** Nombre de questions faciles, moyennes, difficiles. */
  difficulty: [number, number, number];
}

export interface Schedule {
  today: string;
  days: ScheduleDay[];
  used: Record<string, string[]>;
}

export interface DayStats {
  date: string;
  players: number;
  completed: number;
  completion: number | null;
  average: number | null;
  distribution: number[];
  questions: (QuestionSummary & RateStats & { position: number })[];
}

export interface Overview {
  today: DayStats;
  series: { date: string; players: number; completed: number; average: number | null }[];
  kpis: {
    players_today: number;
    players_7d: number;
    total_users: number;
    questions_published: number;
    questions_draft: number;
    days_planned_ahead: number;
    reports: number;
  };
  hardest: (QuestionSummary & RateStats)[];
  easiest: (QuestionSummary & RateStats)[];
  kinds: (RateStats & {
    category: string;
    label: string;
    emoji: string;
    published: number;
    draft: number;
    levels: [number, number, number];
  })[];
}
