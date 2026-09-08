import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get('participant_id');

    if (!participantId) {
      return NextResponse.json({ error: 'Participant ID is required for session restore' }, { status: 400 });
    }

    const session = await db.getSessionByCode(code);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const participant = await db.getParticipantById(session.id, participantId);
    if (!participant) {
      return NextResponse.json({ error: 'Participant not found in this session' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      participant: {
        id: participant.id,
        name: participant.name,
        roll_no: participant.roll_no,
        department: participant.department,
        email: participant.email,
        warning_count: participant.warning_count,
        status: participant.status,
        total_score: participant.total_score,
        total_response_time_ms: participant.total_response_time_ms,
      },
      session_status: session.status,
      current_state: session.current_state,
      current_question_index: session.current_question_index,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to restore session' }, { status: 500 });
  }
}
