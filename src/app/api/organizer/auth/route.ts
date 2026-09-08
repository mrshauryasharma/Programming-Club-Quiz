import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const expectedPassword = process.env.ORGANIZER_PASSWORD || 'gbu@soict2026';

    if (!password || password.trim() !== expectedPassword.trim()) {
      return NextResponse.json({ error: 'Invalid organizer password' }, { status: 401 });
    }

    // Set simple organizer session token in response
    const token = Buffer.from(`organizer:${Date.now()}`).toString('base64');
    const response = NextResponse.json({ success: true, message: 'Organizer authenticated successfully' });

    response.cookies.set('organizer_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12, // 12 hours
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Authentication error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('organizer_token')?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Logged out' });
  response.cookies.delete('organizer_token');
  return response;
}
