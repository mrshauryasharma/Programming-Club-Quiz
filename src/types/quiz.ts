export type SessionState =
  | 'WAITING'
  | 'QUESTION_ACTIVE'
  | 'QUESTION_ENDED'
  | 'SHOW_LEADERBOARD'
  | 'FINAL_RESULTS'
  | 'COMPLETED';

export type SessionStatus = 'waiting' | 'active' | 'completed';

export type ParticipantStatus = 'active' | 'warning_1' | 'warning_2' | 'removed';

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  options: string[]; // 4 options
  correct_option_index: number; // Server-only (0..3)
  timer_seconds: number; // 10..120
  order_index: number;
}

export interface ClientQuestion {
  id: string;
  question_text: string;
  options: string[];
  timer_seconds: number;
  order_index: number;
  total_questions: number;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
  questions?: Question[];
  question_count?: number;
}

export interface Session {
  id: string;
  quiz_id: string;
  game_code: string;
  status: SessionStatus;
  current_question_index: number;
  question_start_time: number | null; // epoch ms
  current_state: SessionState;
  created_at: string;
  ended_at?: string | null;
}

export interface Participant {
  id: string;
  session_id: string;
  name: string;
  roll_no: string;
  year: string; // '1st Year' | '2nd Year' | '3rd Year' | '4th Year' | '5th Year'
  department: string;
  custom_department?: string;
  email: string;
  warning_count: number; // 0..3
  status: ParticipantStatus;
  total_score: number; // sum of points (+2 per correct)
  total_response_time_ms: number; // sum of response times in ms
  joined_at: string;
  rank?: number;
}

export interface Answer {
  id: string;
  session_id: string;
  participant_id: string;
  question_id: string;
  selected_option: number; // 0..3
  is_correct: boolean;
  points: number; // 0 or 2
  response_time_ms: number;
  submitted_at: string;
}

export interface SecurityLog {
  id: string;
  session_id: string;
  participant_id: string;
  violation_type: string;
  warning_level: number;
  recorded_at: string;
}

export interface QuestionResultSummary {
  question_id: string;
  question_text: string;
  correct_option_index: number;
  total_answers: number;
  correct_count: number;
  incorrect_count: number;
  option_counts: [number, number, number, number];
  fastest_answer_ms: number | null;
  fastest_participant_name: string | null;
  average_response_time_ms: number | null;
}

export interface SessionHistoryItem {
  id: string; // Session ID (UUID)
  quiz_id: string;
  quiz_title: string;
  game_code: string;
  status: SessionStatus;
  current_state: SessionState;
  created_at: string;
  ended_at?: string | null;
  total_participants: number;
  average_score: string;
  total_questions: number;
}
