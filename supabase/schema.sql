-- Programming Club Quiz — Supabase Database Schema
-- Run this in your Supabase SQL Editor to set up the database tables and policies.

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Questions Table
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of string options: ["Option A", "Option B", "Option C", "Option D"]
  correct_option_index INT NOT NULL, -- Server-only index 0..3
  timer_seconds INT NOT NULL DEFAULT 30 CHECK (timer_seconds >= 10 AND timer_seconds <= 120),
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Live Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
  game_code VARCHAR(6) NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed')),
  current_question_index INT NOT NULL DEFAULT 0,
  question_start_time BIGINT, -- epoch millisecond timestamp when question was activated
  current_state TEXT NOT NULL DEFAULT 'WAITING' CHECK (current_state IN ('WAITING', 'QUESTION_ACTIVE', 'QUESTION_ENDED', 'SHOW_LEADERBOARD', 'FINAL_RESULTS', 'COMPLETED')),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  ended_at TIMESTAMPTZ
);

-- 5. Session Participants Table
CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  roll_no TEXT NOT NULL,
  year TEXT NOT NULL DEFAULT '1st Year',
  department TEXT NOT NULL,
  custom_department TEXT,
  email TEXT NOT NULL,
  warning_count INT NOT NULL DEFAULT 0 CHECK (warning_count >= 0 AND warning_count <= 3),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'warning_1', 'warning_2', 'removed')),
  total_score INT NOT NULL DEFAULT 0,
  total_response_time_ms BIGINT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_session_participant_roll UNIQUE (session_id, roll_no)
);

-- Migration statement if updating existing table
ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS year TEXT NOT NULL DEFAULT '1st Year';
ALTER TABLE session_participants ADD COLUMN IF NOT EXISTS custom_department TEXT;

-- 6. Session Answers Table
CREATE TABLE IF NOT EXISTS session_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES session_participants(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  selected_option INT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points INT NOT NULL DEFAULT 0 CHECK (points IN (0, 2)),
  response_time_ms BIGINT NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_participant_question_answer UNIQUE (session_id, participant_id, question_id)
);

-- 7. Security Logs Table
CREATE TABLE IF NOT EXISTS security_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES session_participants(id) ON DELETE CASCADE NOT NULL,
  violation_type TEXT NOT NULL,
  warning_level INT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_questions_quiz_order ON questions(quiz_id, order_index);
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(game_code);
CREATE INDEX IF NOT EXISTS idx_participants_session ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_session ON session_answers(session_id);

-- Enable Supabase Realtime for instant synchronization
ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE session_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE session_answers;
