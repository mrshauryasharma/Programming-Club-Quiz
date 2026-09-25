import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastSessionEvent } from '@/lib/realtime';

export async function POST(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const { participant_id, appeal_note } = await req.json();

    if (!participant_id) {
      return NextResponse.json({ error: 'Participant ID is required' }, { status: 400 });
    }

    if (!appeal_note || !appeal_note.trim()) {
      return NextResponse.json({ error: 'Appeal note cannot be empty' }, { status: 400 });
    }

    const updatedParticipant = await db.submitAppeal(code, participant_id, appeal_note);

    // Broadcast student appeal to organizer console
    await broadcastSessionEvent(code, 'STUDENT_APPEAL', {
      participant_id,
      name: updatedParticipant.name,
      roll_no: updatedParticipant.roll_no,
      appeal_note: updatedParticipant.appeal_note,
    });

    return NextResponse.json({
      success: true,
      participant: updatedParticipant,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to submit appeal' }, { status: 400 });
  }
}
