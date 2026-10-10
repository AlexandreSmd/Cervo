// Contrats de l'API (miroir des réponses de api/cervo/web/*).
export type QuestionType = "binary" | "mcq" | "numeric" | "short_text" | "order" | "size" | "dictation";
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
  category: string;
  category_label: string;
  pillar: string;
  difficulty: number;
  prompt: string;
  images: ImageRef[];
  choices: string[] | null;
  unit: string | null;
  time_limit: number;
  memorize?: Memorize | null;
  items?: string[];
  size?: SizeConfig;
  slider?: { min: number; max: number; step: number };
  speech?: string;
}

export interface Memorize {
  items: string[];
  seconds: number;
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
}

export interface AnswerResult extends Reveal {
  question_id: string;
  position: number;
  user_answer: Answer | null;
  score: number;
  timed_out?: boolean;
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

export interface SubmitResult extends AnswerResult {
  completed: boolean;
  score_total: number | null;
  streak: number;
}

export interface DayItem extends PublicQuestion, Reveal {
  question_id: string;
  user_answer: Answer | null;
  score: number;
}

export interface DayDetail {
  date: string;
  score_total: number;
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
  categories: { category: string; label: string; average: number | null; count: number }[];
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
}
