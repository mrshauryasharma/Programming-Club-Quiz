import { getSupabaseServerClient } from './supabase';

export type RealtimeEvent =
  | 'STATE_CHANGE'
  | 'PARTICIPANT_JOINED'
  | 'QUESTION_STARTED'
  | 'QUESTION_ENDED'
  | 'SHOW_LEADERBOARD'
  | 'FINAL_RESULTS'
  | 'PARTICIPANT_REMOVED'
  | 'SECURITY_ALERT'
  | 'STUDENT_APPEAL'
  | 'PARTICIPANT_AUDIT_UPDATED'
  | 'TIMER_TICK';

export interface BroadcastPayload {
  event: RealtimeEvent;
  session_code: string;
  data: Record<string, any>;
  timestamp: number;
}

// In-memory channel listeners for instant local testing and fallback
type ChannelCallback = (payload: BroadcastPayload) => void;
const channelListeners = new Map<string, Set<ChannelCallback>>();

export async function broadcastSessionEvent(
  sessionCode: string,
  event: RealtimeEvent,
  data: Record<string, any>
): Promise<void> {
  const normalizedCode = sessionCode.trim().toUpperCase();
  const payload: BroadcastPayload = {
    event,
    session_code: normalizedCode,
    data,
    timestamp: Date.now(),
  };

  // 1. Dispatch to in-memory local subscribers (for fast SSR / local multi-tab sync)
  const listeners = channelListeners.get(normalizedCode);
  if (listeners) {
    listeners.forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.error('Error in local channel listener:', err);
      }
    });
  }

  // 2. Dispatch via Supabase Realtime Broadcast if Supabase server client is active
  const supabase = getSupabaseServerClient();
  if (supabase) {
    try {
      const channel = supabase.channel(`session_${normalizedCode}`);
      await channel.send({
        type: 'broadcast',
        event,
        payload: data,
      });
    } catch (err) {
      console.warn('Supabase realtime broadcast warning:', err);
    }
  }
}

export function subscribeToSessionChannel(
  sessionCode: string,
  callback: ChannelCallback
): () => void {
  const normalizedCode = sessionCode.trim().toUpperCase();
  if (!channelListeners.has(normalizedCode)) {
    channelListeners.set(normalizedCode, new Set());
  }
  const set = channelListeners.get(normalizedCode)!;
  set.add(callback);

  return () => {
    set.delete(callback);
    if (set.size === 0) {
      channelListeners.delete(normalizedCode);
    }
  };
}
