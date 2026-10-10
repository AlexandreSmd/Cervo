export type QuestionType = "binary" | "mcq" | "numeric" | "short_text";
export type Answer = string | number | boolean;

export interface PublicQuestion {
  id: string;
  position: number;
  type: QuestionType;
  category: string;
  category_label: string;
  pillar: string;
  difficulty: number;
  prompt: string;
  image_url: string | null;
  image_alt: string | null;
  image_credit: string | null;
  choices: string[] | null;
  unit: string | null;
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

export interface AdminQuestion {
  id: string;
  type: QuestionType;
  category: string;
  difficulty: number;
  prompt: string;
  status: "draft" | "published" | "retired";
  correct_answer: Answer;
  choices?: string[] | null;
  explanation?: string;
  image_url?: string | null;
  created_at?: string;
  reports: number;
}
