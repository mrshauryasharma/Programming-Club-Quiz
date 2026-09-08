import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastSessionEvent, RealtimeEvent } from '@/lib/realtime';

export async function POST(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const { action } = await req.json();

    const validActions = [
      'START_QUESTION',
      'END_QUESTION',
      'SHOW_LEADERBOARD',
      'NEXT_QUESTION',
      'FINAL_RESULTS',
      'END_QUIZ',
    ];

    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    const session = await db.transitionSessionState(code, action as any);

    let eventName: RealtimeEvent = 'STATE_CHANGE';
    if (action === 'START_QUESTION' || action === 'NEXT_QUESTION') eventName = 'QUESTION_STARTED';
    else if (action === 'END_QUESTION') eventName = 'QUESTION_ENDED';
    else if (action === 'SHOW_LEADERBOARD') eventName = 'SHOW_LEADERBOARD';
    else if (action === 'FINAL_RESULTS' || action === 'END_QUIZ') eventName = 'FINAL_RESULTS';

    await broadcastSessionEvent(session.game_code, eventName, {
      action,
      status: session.status,
      current_state: session.current_state,
      current_question_index: session.current_question_index,
      question_start_time: session.question_start_time,
    });

    return NextResponse.json({ session });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to perform session action' }, { status: 500 });
  }
}
