import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const cleanCode = code?.trim().toUpperCase();

    if (!cleanCode || cleanCode.length < 4) {
      return NextResponse.json({ valid: false, error: 'Please enter a valid Game Code' }, { status: 400 });
    }

    const session = await db.getSessionByCode(cleanCode);
    if (!session) {
      return NextResponse.json({ valid: false, error: 'Invalid Game Code. No active session found.' }, { status: 404 });
    }

    if (session.status === 'completed') {
      return NextResponse.json({ valid: false, error: 'This quiz session has already concluded.' }, { status: 400 });
    }

    const quiz = await db.getQuizById(session.quiz_id);

    return NextResponse.json({
      valid: true,
      game_code: session.game_code,
      quiz_title: quiz?.title || 'Programming Club Quiz',
      status: session.status,
      current_state: session.current_state,
    });
  } catch (error: any) {
    return NextResponse.json({ valid: false, error: error.message || 'Validation error' }, { status: 500 });
  }
}
