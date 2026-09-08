import { NextRequest } from 'next/server';
import { subscribeToSessionChannel, BroadcastPayload } from '@/lib/realtime';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const sessionCode = code.trim().toUpperCase();

  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial connected heartbeat
  writer.write(encoder.encode(`event: ping\ndata: ${JSON.stringify({ connected: true, code: sessionCode })}\n\n`));

  const unsubscribe = subscribeToSessionChannel(sessionCode, (payload: BroadcastPayload) => {
    try {
      const sseMsg = `event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`;
      writer.write(encoder.encode(sseMsg));
    } catch (err) {
      console.warn('Error sending SSE message:', err);
    }
  });

  req.signal.addEventListener('abort', () => {
    unsubscribe();
    writer.close().catch(() => {});
  });

  return new Response(responseStream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
