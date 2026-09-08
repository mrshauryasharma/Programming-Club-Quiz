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
 * When time expires, automatically triggers handleTimerExpiry.
 */
export function startQuestionTimer(
  sessionId: string,
  gameCode: string,
  questionIndex: number,
  durationMs: number
): void {
  cancelSessionTimer(sessionId);

  const timeout = setTimeout(async () => {
    activeTimers.delete(sessionId);
    await handleTimerExpiry(sessionId, gameCode, questionIndex);
  }, durationMs);

  activeTimers.set(sessionId, timeout);
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
  const existing = pendingAdvances.get(sessionId);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(async () => {
    pendingAdvances.delete(sessionId);
    await handleAdvanceToNextOrFinal(sessionId, gameCode, questionIndex);
  }, delayMs);

  pendingAdvances.set(sessionId, timeout);
}

/**
 * Handles automatic expiration when question countdown reaches 0:
 * QUESTION_ACTIVE -> QUESTION_ENDED
 */
export async function handleTimerExpiry(
  sessionId: string,
  gameCode: string,
  questionIndex: number
): Promise<void> {
  const lockKey = `${sessionId}_expire_${questionIndex}`;
  if (transitionLocks.has(lockKey)) return;
  transitionLocks.add(lockKey);

  try {
    const session = await db.getSessionById(sessionId);
    if (
      !session ||
      session.current_state !== 'QUESTION_ACTIVE' ||
      session.current_question_index !== questionIndex
    ) {
      return;
    }

    // 1. Transition to QUESTION_ENDED
    const updatedSession = await db.transitionSessionState(gameCode, 'END_QUESTION');

    // 2. Broadcast QUESTION_ENDED to Projector, Organizer, and Participants
    await broadcastSessionEvent(gameCode, 'QUESTION_ENDED', {
      action: 'END_QUESTION',
      status: updatedSession.status,
      current_state: updatedSession.current_state,
      current_question_index: updatedSession.current_question_index,
      question_start_time: updatedSession.question_start_time,
    });

    // 3. Automatically schedule next question or final results after result processing delay
    scheduleNextAdvance(sessionId, gameCode, questionIndex, RESULT_PROCESSING_DELAY_MS);
  } catch (err) {
    console.error('Error handling automatic timer expiry:', err);
  } finally {
    setTimeout(() => transitionLocks.delete(lockKey), 4000);
  }
}

/**
 * Handles automatic transition after result processing:
 * QUESTION_ENDED -> NEXT_QUESTION (QUESTION_ACTIVE) or FINAL_RESULTS -> COMPLETED
 */
export async function handleAdvanceToNextOrFinal(
  sessionId: string,
  gameCode: string,
  questionIndex: number
): Promise<void> {
  const lockKey = `${sessionId}_advance_${questionIndex}`;
  if (transitionLocks.has(lockKey)) return;
  transitionLocks.add(lockKey);

  try {
    const session = await db.getSessionById(sessionId);
    if (
      !session ||
      session.current_state !== 'QUESTION_ENDED' ||
      session.current_question_index !== questionIndex
    ) {
      return;
    }

    const quiz = await db.getQuizById(session.quiz_id);
    const totalQuestions = quiz?.questions?.length || 0;
    const isFinalQuestion = session.current_question_index + 1 >= totalQuestions;

    if (isFinalQuestion) {
      // Final Question: QUESTION_ENDED -> FINAL_RESULTS (status: completed)
      const finalSession = await db.transitionSessionState(gameCode, 'FINAL_RESULTS');

      await broadcastSessionEvent(gameCode, 'FINAL_RESULTS', {
        action: 'FINAL_RESULTS',
        status: finalSession.status,
        current_state: finalSession.current_state,
        current_question_index: finalSession.current_question_index,
      });
    } else {
      // Next Question: QUESTION_ENDED -> NEXT_QUESTION (QUESTION_ACTIVE)
      const nextSession = await db.transitionSessionState(gameCode, 'NEXT_QUESTION');

      await broadcastSessionEvent(gameCode, 'QUESTION_STARTED', {
        action: 'NEXT_QUESTION',
        status: nextSession.status,
        current_state: nextSession.current_state,
        current_question_index: nextSession.current_question_index,
        question_start_time: nextSession.question_start_time,
      });

      // Start automatic timer for the new active question
      const nextQ = quiz?.questions?.[nextSession.current_question_index];
      if (nextQ) {
        startQuestionTimer(
          sessionId,
          gameCode,
          nextSession.current_question_index,
          nextQ.timer_seconds * 1000
        );
      }
    }
  } catch (err) {
    console.error('Error in automatic question advance:', err);
  } finally {
    setTimeout(() => transitionLocks.delete(lockKey), 4000);
  }
}

/**
 * Authoritative lazy check for state requests.
 * If elapsed time exceeds timer limit, ensures state is advanced even if timer event was delayed.
 */
export async function checkAndAdvanceIfExpired(session: Session): Promise<Session> {
  if (
    session.status === 'completed' ||
    session.current_state === 'FINAL_RESULTS' ||
    session.current_state === 'COMPLETED'
  ) {
    return session;
  }

  const now = Date.now();
  const quiz = await db.getQuizById(session.quiz_id);
  if (!quiz || !quiz.questions) return session;
  const currentQ = quiz.questions[session.current_question_index];
  if (!currentQ) return session;

  const timerLimitMs = currentQ.timer_seconds * 1000;

  if (session.current_state === 'QUESTION_ACTIVE' && session.question_start_time) {
    const elapsed = now - session.question_start_time;
    if (elapsed >= timerLimitMs) {
      await handleTimerExpiry(session.id, session.game_code, session.current_question_index);
      const reloaded = await db.getSessionById(session.id);
      return reloaded || session;
    }
  } else if (session.current_state === 'QUESTION_ENDED' && session.question_start_time) {
    const elapsed = now - session.question_start_time;
    if (elapsed >= timerLimitMs + RESULT_PROCESSING_DELAY_MS) {
      await handleAdvanceToNextOrFinal(session.id, session.game_code, session.current_question_index);
      const reloaded = await db.getSessionById(session.id);
      return reloaded || session;
    }
  }

  return session;
}
