import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastSessionEvent } from '@/lib/realtime';

export async function POST(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const { participant_id, violation_type } = await req.json();

    if (!participant_id) {
      return NextResponse.json({ error: 'Participant ID is required' }, { status: 400 });
    }

    const violation = violation_type || 'visibility_hidden_or_window_blur';
    const result = await db.reportViolation(code, participant_id, violation);

    if (result.is_removed) {
      await broadcastSessionEvent(code, 'PARTICIPANT_REMOVED', {
        participant_id,
        reason: 'Maximum anti-cheat warnings exceeded (3 violations)',
      });
    }

    return NextResponse.json({
      success: true,
      warning_count: result.warning_count,
      status: result.status,
      is_removed: result.is_removed,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to record anti-cheat violation' }, { status: 400 });
  }
}
