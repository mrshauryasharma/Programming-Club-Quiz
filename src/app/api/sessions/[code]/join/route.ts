import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastSessionEvent } from '@/lib/realtime';

export async function POST(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const body = await req.json();
    const { name, roll_no, year, department, custom_department, email } = body;

    const { participant, session } = await db.joinSession(code, {
      name,
      roll_no,
      year,
      department,
      custom_department,
      email,
    });

    await broadcastSessionEvent(session.game_code, 'PARTICIPANT_JOINED', {
      participant_id: participant.id,
      name: participant.name,
      roll_no: participant.roll_no,
      year: participant.year,
      department: participant.department,
    });

    return NextResponse.json({ participant, session });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to join quiz session' }, { status: 400 });
  }
}
