import { db } from './db';
import { broadcastSessionEvent } from './realtime';
import { Session } from '@/types/quiz';

// In-memory active timer tracking
const activeTimers = new Map<string, NodeJS.Timeout>();
const pendingAdvances = new Map<string, NodeJS.Timeout>();
const transitionLocks = new Set<string>();

// 2.5 seconds result display time before advancing automatically to next question
export const RESULT_PROCESSING_DELAY_MS = 2500;

/**
 * Cancel any scheduled timer or advance for a session
 */
export function cancelSessionTimer(sessionId: string): void {
  const t = activeTimers.get(sessionId);
  if (t) {
    clearTimeout(t);
    activeTimers.delete(sessionId);
  }
  const p = pendingAdvances.get(sessionId);
  if (p) {
    clearTimeout(p);
    pendingAdvances.delete(sessionId);
  }
}

/**
 * Starts the server-authoritative timer for a question.
 * Note: In Playground / Self-Paced mode, participants progress on their own timers.
 */
export function startQuestionTimer(
  sessionId: string,
  gameCode: string,
  questionIndex: number,
  durationMs: number
): void {
  // Cancel previous timers; playground mode does not forcefully auto-kill live sessions
  cancelSessionTimer(sessionId);
}

/**
 * Schedules automatic advance from QUESTION_ENDED to NEXT_QUESTION or FINAL_RESULTS.
 */
export function scheduleNextAdvance(
  sessionId: string,
  gameCode: string,
  questionIndex: number,
  delayMs: number = RESULT_PROCESSING_DELAY_MS
): void {
  // No-op for self-paced / live playground sessions
}

/**
 * Handles automatic expiration when question countdown reaches 0
 */
export async function handleTimerExpiry(
  sessionId: string,
  gameCode: string,
  questionIndex: number
): Promise<void> {
  // Retained for backward compatibility
}

/**
 * Handles transition after result processing
 */
export async function handleAdvanceToNextOrFinal(
  sessionId: string,
  gameCode: string,
  questionIndex: number
): Promise<void> {
  // Retained for backward compatibility
}

/**
 * Authoritative check for state requests.
 * Live sessions remain active until explicitly concluded by the organizer via END_QUIZ.
 */
export async function checkAndAdvanceIfExpired(session: Session): Promise<Session> {
  // In Playground / Self-Paced mode, the session remains active during the event window.
  // The Organizer controls the session lifecycle with 'START LIVE QUIZ' and 'END QUIZ NOW'.
  return session;
}
