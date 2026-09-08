import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const history = await db.getSessionHistory();
    return NextResponse.json({ history });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch session history' },
      { status: 500 }
    );
  }
}
