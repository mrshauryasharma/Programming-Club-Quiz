import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastSessionEvent } from '@/lib/realtime';

export async function POST(req: NextRequest) {
  try {
    const { quiz_id } = await req.json();
    if (!quiz_id) {
      return NextResponse.json({ error: 'Quiz ID is required' }, { status: 400 });
    }

    const session = await db.createSession(quiz_id);

    // Broadcast session initialized
    await broadcastSessionEvent(session.game_code, 'STATE_CHANGE', {
      status: session.status,
      current_state: session.current_state,
      game_code: session.game_code,
    });

    return NextResponse.json({ session });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create session' }, { status: 500 });
  }
}
