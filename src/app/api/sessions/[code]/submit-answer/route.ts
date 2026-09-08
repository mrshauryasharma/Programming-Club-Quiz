import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const { participant_id, question_id, selected_option } = await req.json();

    if (!participant_id) {
      return NextResponse.json({ error: 'Participant ID is required' }, { status: 400 });
    }
    if (!question_id) {
      return NextResponse.json({ error: 'Question ID is required' }, { status: 400 });
    }
    if (typeof selected_option !== 'number' || selected_option < 0 || selected_option > 3) {
      return NextResponse.json({ error: 'Invalid option selected' }, { status: 400 });
    }

    const result = await db.submitAnswer(code, participant_id, question_id, selected_option);

    return NextResponse.json({
      success: true,
      points: result.points,
      is_correct: result.is_correct,
      response_time_ms: result.response_time_ms,
      total_score: result.total_score,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to submit answer' }, { status: 400 });
  }
}
