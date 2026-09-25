'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { Wifi, WifiOff, Users, Clock, Sparkles } from 'lucide-react';

export default function WaitingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string)?.toUpperCase();

  const [participantName, setParticipantName] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [sessionData, setSessionData] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Retrieve stored participant credentials
    const storedId = sessionStorage.getItem('pc_quiz_participant_id');
    const storedName = sessionStorage.getItem('pc_quiz_participant_name');
    const storedCode = sessionStorage.getItem('pc_quiz_session_code');

    if (!storedId || storedCode !== code) {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('pc_quiz_participant_id');
        sessionStorage.removeItem('pc_quiz_participant_name');
        sessionStorage.removeItem('pc_quiz_session_code');
      }
      router.push(`/?code=${code}`);
      return;
    }

    setParticipantId(storedId);
    setParticipantName(storedName || 'Participant');

    // Network status listeners (disconnection is NOT cheating)
    const handleOnline = () => {
      setIsConnected(true);
      fetchState();
    };
    const handleOffline = () => setIsConnected(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Immediate state fetch with cache-busting
    const fetchState = async () => {
      try {
        const res = await fetch(`/api/sessions/${code}/state?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
        });
        if (!res.ok) throw new Error('Session not found');
        const data = await res.json();
        setSessionData(data);

        // If quiz has started (any non-waiting state or active status), immediately redirect to play screen
        const currentState = data.session?.current_state;
        const status = data.session?.status?.toLowerCase();
        const isStarted = (currentState && currentState !== 'WAITING') || status === 'active' || status === 'completed';

        if (isStarted) {
          router.push(`/session/${code}/play`);
        }
      } catch (err: any) {
        setError(err.message || 'Unable to connect to session');
      }
    };

    fetchState();
    // Fast polling: 1500ms ensures instant pickup if WebSocket or SSE is throttled
    const interval = setInterval(fetchState, 1500);

    // Wakeup listener when tab or screen is focused after waiting in background
    const handleWakeup = () => {
      if (document.visibilityState === 'visible') {
        fetchState();
      }
    };
    document.addEventListener('visibilitychange', handleWakeup);
    window.addEventListener('focus', handleWakeup);

    // Supabase Realtime channel subscription
    const supabase = getSupabaseBrowserClient();
    let channel: any = null;

    if (supabase) {
      channel = supabase
        .channel(`session_${code}`)
        .on('broadcast', { event: 'QUESTION_STARTED' }, () => {
          router.push(`/session/${code}/play`);
        })
        .on('broadcast', { event: 'STATE_CHANGE' }, (payload: any) => {
          const st = payload.payload?.current_state;
          if (st && st !== 'WAITING') {
            router.push(`/session/${code}/play`);
          }
        })
        .subscribe();
    }

    // Server-Sent Events listener fallback
    const eventSource = new EventSource(`/api/sessions/${code}/events`);
    eventSource.addEventListener('QUESTION_STARTED', () => {
      router.push(`/session/${code}/play`);
    });
    eventSource.addEventListener('STATE_CHANGE', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.current_state && data.current_state !== 'WAITING') {
          router.push(`/session/${code}/play`);
        }
      } catch (err) {}
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleWakeup);
      window.removeEventListener('focus', handleWakeup);
      if (channel && supabase) supabase.removeChannel(channel);
      eventSource.close();
    };
  }, [code, router]);

  return (
    <main className="min-h-screen flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-gradient-to-b from-[#F8FAFC] via-white to-[#F1F5F9] text-[#031246]">
      {/* Top Navigation */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-brand-purple/30 shadow-sm">
            <Image src="/logo.png" alt="Logo" fill className="object-contain" priority />
          </div>
          <div>
            <h1 className="text-xs font-bold text-brand-purple uppercase">USICT GBU</h1>
            <p className="text-[10px] text-slate-500 font-medium">Programming Club</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200 animate-pulse'
            }`}
          >
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>{isConnected ? 'Connected' : 'Reconnecting...'}</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Card */}
      <div className="w-full max-w-md mx-auto my-auto py-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-200/60 text-center backdrop-blur-md">
          {/* Animated Spinner Icon */}
          <div className="relative w-20 h-20 mx-auto mb-5 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-brand-purple/20 animate-ping opacity-25" />
            <div className="w-20 h-20 rounded-full border-4 border-brand-purple/30 border-t-brand-purple animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-brand-purple">
              <Clock className="w-8 h-8" />
            </div>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-brand-navy">You are in the waiting room!</h2>
          <p className="text-xs text-slate-500 mt-1">
            Waiting for the organizer to start the quiz...
          </p>

          {/* Participant Info Badge */}
          <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Participant</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-purple">
                <Sparkles className="w-3 h-3" /> Ready
              </span>
            </div>
            <p className="text-base font-bold mt-0.5 text-brand-navy">{participantName}</p>

            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">Game Code:</span>
              <span className="font-mono font-bold tracking-wider text-brand-purple text-sm">{code}</span>
            </div>

            {sessionData && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">Quiz Title:</span>
                <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                  {sessionData.quiz_title}
                </span>
              </div>
            )}
          </div>

          {/* Live Participant Count */}
          <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-purple/10 text-brand-purple text-xs font-semibold">
            <Users className="w-4 h-4" />
            <span>
              {sessionData ? `${sessionData.participant_count} student(s) in lobby` : 'Connecting to lobby...'}
            </span>
          </div>

          {/* Device & anti-cheat tips */}
          <p className="mt-6 text-[11px] text-slate-500 leading-relaxed">
            Tip: Please keep this tab open. Switching tabs or leaving the screen will trigger an anti-cheat warning.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto text-center py-2 text-[11px] text-slate-500">
        <p>USICT GBU Programming Club • Official Quiz</p>
      </footer>
    </main>
  );
}
