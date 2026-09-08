import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cancelSessionTimer } from '@/lib/sessionTimer';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    cancelSessionTimer(id);
    const success = await db.deleteSession(id);
    if (!success) {
      return NextResponse.json({ error: 'Quiz event not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Quiz event and associated session results deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete quiz event' },
      { status: 500 }
    );
  }
}
