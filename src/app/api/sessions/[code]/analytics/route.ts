import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const session = await db.getSessionByCode(code);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const analytics = await db.getSessionAnalytics(session.id);
    if (!analytics) {
      return NextResponse.json({ error: 'Analytics could not be compiled' }, { status: 500 });
    }

    return NextResponse.json({ analytics });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch analytics' }, { status: 500 });
  }
}
