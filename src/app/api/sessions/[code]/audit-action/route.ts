import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastSessionEvent } from '@/lib/realtime';

export async function GET(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const session = await db.getSessionByCode(code);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const participantId = searchParams.get('participant_id') || undefined;

    const logs = await db.getSecurityLogs(session.id, participantId);
    let participant = null;
    if (participantId) {
      participant = await db.getParticipantById(session.id, participantId);
    }

    return NextResponse.json({
      success: true,
      logs,
      participant,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch security logs' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const { participant_id, action } = await req.json();

    if (!participant_id) {
      return NextResponse.json({ error: 'Participant ID is required' }, { status: 400 });
    }

    if (!action || !['pardon', 'disqualify'].includes(action)) {
      return NextResponse.json({ error: 'Action must be pardon or disqualify' }, { status: 400 });
    }

    const updatedParticipant = await db.auditAction(code, participant_id, action);

    // Broadcast audit decision to projector and participants
    await broadcastSessionEvent(code, 'PARTICIPANT_AUDIT_UPDATED', {
      participant_id,
      name: updatedParticipant.name,
      roll_no: updatedParticipant.roll_no,
      status: updatedParticipant.status,
      action,
      resolved_by: updatedParticipant.resolved_by,
      total_score: updatedParticipant.total_score,
    });

    return NextResponse.json({
      success: true,
      participant: updatedParticipant,
      action,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to execute audit action' }, { status: 400 });
  }
}
