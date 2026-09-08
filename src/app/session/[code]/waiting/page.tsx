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

    if (!storedId) {
      router.push(`/?code=${code}`);
      return;
    }

    setParticipantId(storedId);
    setParticipantName(storedName || 'Participant');

    // Network status listeners (disconnection is NOT cheating)
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state fetch
    const fetchState = async () => {
      try {
        const res = await fetch(`/api/sessions/${code}/state`);
        if (!res.ok) throw new Error('Session not found');
        const data = await res.json();
        setSessionData(data);

        // If quiz has already started or is active, redirect to play screen
        if (data.session.current_state === 'QUESTION_ACTIVE') {
          router.push(`/session/${code}/play`);
        }
      } catch (err: any) {
        setError(err.message || 'Unable to connect to session');
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 2500);

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
          if (payload.payload?.current_state === 'QUESTION_ACTIVE') {
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
        if (data.current_state === 'QUESTION_ACTIVE') {
          router.push(`/session/${code}/play`);
        }
      } catch (err) {}
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (channel && supabase) supabase.removeChannel(channel);
      eventSource.close();
    };
  }, [code, router]);

  return (
    <main className="min-h-screen flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-gradient-to-b from-[#F7F4FE] via-white to-[#EDE8FD] dark:from-[#020205] dark:via-[#030926] dark:to-[#020205] text-[#031246] dark:text-[#F7F4FE]">
      {/* Top Navigation */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-brand-purple/30">
            <Image src="/logo.png" alt="Logo" fill className="object-contain" priority />
          </div>
          <div>
            <h1 className="text-xs font-bold text-brand-purple uppercase">USICT GBU</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Programming Club</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse'
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
        <div className="bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark rounded-2xl p-6 sm:p-8 shadow-xl text-center backdrop-blur-md">
          {/* Animated Spinner Icon */}
          <div className="relative w-20 h-20 mx-auto mb-5 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-brand-purple/20 animate-ping opacity-25" />
            <div className="w-20 h-20 rounded-full border-4 border-brand-purple/30 border-t-brand-purple animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center text-brand-purple">
              <Clock className="w-8 h-8" />
            </div>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight">You are in the waiting room!</h2>
          <p className="text-xs text-slate-500 dark:text-brand-slate mt-1">
            Waiting for the organizer to start the quiz...
          </p>

          {/* Participant Info Badge */}
          <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-[#080E2B] border border-slate-200 dark:border-brand-cardBorderDark text-left">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Participant</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-purple">
                <Sparkles className="w-3 h-3" /> Ready
              </span>
            </div>
            <p className="text-base font-bold mt-0.5 text-brand-navy dark:text-white">{participantName}</p>

            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-brand-cardBorderDark/60 flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">Game Code:</span>
              <span className="font-mono font-bold tracking-wider text-brand-purple text-sm">{code}</span>
            </div>

            {sessionData && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Quiz Title:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                  {sessionData.quiz_title}
                </span>
              </div>
            )}
          </div>

          {/* Live Participant Count */}
          <div className="mt-5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 text-xs font-semibold">
            <Users className="w-4 h-4" />
            <span>
              {sessionData ? `${sessionData.participant_count} student(s) in lobby` : 'Connecting to lobby...'}
            </span>
          </div>

          {/* Device & anti-cheat tips */}
          <p className="mt-6 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
            Tip: Please keep this tab open. Switching tabs or leaving the screen will trigger an anti-cheat warning.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto text-center py-2 text-[11px] text-slate-500 dark:text-slate-400">
        <p>USICT GBU Programming Club • Official Quiz</p>
      </footer>
    </main>
  );
}
