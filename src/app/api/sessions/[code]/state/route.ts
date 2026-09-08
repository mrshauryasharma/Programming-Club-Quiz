import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkAndAdvanceIfExpired } from '@/lib/sessionTimer';

export async function GET(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    let session = await db.getSessionByCode(code);
    if (!session) {
      session = await db.getSessionById(code);
    }
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Authoritative check: Automatically advance if timer expired
    session = await checkAndAdvanceIfExpired(session);

    const quiz = await db.getQuizById(session.quiz_id);
    const participants = await db.getParticipants(session.id);

    let activeQuestion = null;
    let questionSummary = null;
    let leaderboard = null;

    if (quiz && quiz.questions && quiz.questions.length > 0) {
      const q = quiz.questions[session.current_question_index];
      if (q) {
        let remaining_ms = 0;
        if (session.current_state === 'QUESTION_ACTIVE' && session.question_start_time) {
          const elapsed = Date.now() - session.question_start_time;
          const totalMs = q.timer_seconds * 1000;
          remaining_ms = Math.max(0, totalMs - elapsed);
        }

        const revealAnswer = session.current_state !== 'WAITING' && session.current_state !== 'QUESTION_ACTIVE';

        activeQuestion = {
          id: q.id,
          question_text: q.question_text,
          options: q.options,
          timer_seconds: q.timer_seconds,
          order_index: session.current_question_index,
          total_questions: quiz.questions.length,
          remaining_ms,
          ...(revealAnswer ? { correct_option_index: q.correct_option_index } : {}),
        };
      }
    }

    if (session.current_state === 'QUESTION_ENDED' || session.current_state === 'SHOW_LEADERBOARD') {
      questionSummary = await db.getQuestionSummary(session.id, session.current_question_index);
    }

    if (session.current_state === 'SHOW_LEADERBOARD' || session.current_state === 'FINAL_RESULTS' || session.current_state === 'COMPLETED') {
      leaderboard = await db.getLeaderboard(session.id);
    }

    return NextResponse.json({
      session,
      quiz_title: quiz?.title || 'Programming Club Quiz',
      total_questions: quiz?.questions?.length || 0,
      participant_count: participants.length,
      participants: participants.map(p => ({
        id: p.id,
        name: p.name,
        roll_no: p.roll_no,
        year: p.year,
        department: p.department,
        status: p.status,
        warning_count: p.warning_count,
        total_score: p.total_score,
      })),
      activeQuestion,
      questionSummary,
      leaderboard,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch session state' }, { status: 500 });
  }
}
