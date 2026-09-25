import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastSessionEvent } from '@/lib/realtime';

export async function POST(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const { participant_id, violation_type, duration_ms, question_index, details } = await req.json();

    if (!participant_id) {
      return NextResponse.json({ error: 'Participant ID is required' }, { status: 400 });
    }

    const violation = violation_type || 'visibility_hidden_or_window_blur';
    const result = await db.reportViolation(
      code,
      participant_id,
      violation,
      Number(duration_ms) || 0,
      Number(question_index) || 0,
      details
    );

    // Broadcast Realtime Security Alert to Organizer Live Console
    await broadcastSessionEvent(code, 'SECURITY_ALERT', {
      participant_id,
      violation_type: violation,
      warning_count: result.warning_count,
      status: result.status,
      duration_ms: Number(duration_ms) || 0,
      question_index: Number(question_index) || 0,
      is_flagged: result.is_flagged,
      is_removed: result.is_removed,
    });

    if (result.is_removed) {
      await broadcastSessionEvent(code, 'PARTICIPANT_REMOVED', {
        participant_id,
        reason: 'Participant disqualified by organizer',
      });
    }

    return NextResponse.json({
      success: true,
      warning_count: result.warning_count,
      status: result.status,
      is_removed: result.is_removed,
      is_flagged: result.is_flagged,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to record anti-cheat violation' }, { status: 400 });
  }
}
