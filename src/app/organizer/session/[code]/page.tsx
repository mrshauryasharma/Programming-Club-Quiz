'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import {
  Play,
  Trophy,
  ExternalLink,
  Users,
  AlertTriangle,
  Ban,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Clock,
  BarChart3,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';

export default function OrganizerLiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string)?.toUpperCase();

  const [sessionData, setSessionData] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  const fetchSessionState = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${code}/state?include_participants=true`);
      if (!res.ok) return;
      const data = await res.json();
      setSessionData(data);
    } catch (e) {
      console.error('Failed to fetch session state:', e);
    }
  }, [code]);

  useEffect(() => {
    fetchSessionState();
    const interval = setInterval(fetchSessionState, 2000);

    const supabase = getSupabaseBrowserClient();
    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel(`session_${code}`)
        .on('broadcast', { event: 'PARTICIPANT_JOINED' }, () => fetchSessionState())
        .on('broadcast', { event: 'STATE_CHANGE' }, () => fetchSessionState())
        .on('broadcast', { event: 'QUESTION_STARTED' }, () => fetchSessionState())
        .on('broadcast', { event: 'QUESTION_ENDED' }, () => fetchSessionState())
        .on('broadcast', { event: 'SHOW_LEADERBOARD' }, () => fetchSessionState())
        .on('broadcast', { event: 'FINAL_RESULTS' }, () => fetchSessionState())
        .on('broadcast', { event: 'PARTICIPANT_REMOVED' }, () => fetchSessionState())
        .subscribe();
    }

    // SSE fallback
    const eventSource = new EventSource(`/api/sessions/${code}/events`);
    eventSource.onmessage = () => fetchSessionState();

    return () => {
      clearInterval(interval);
      if (channel && supabase) supabase.removeChannel(channel);
      eventSource.close();
    };
  }, [code, fetchSessionState]);

  // Stopwatch for active live quiz duration
  useEffect(() => {
    if (sessionData?.session?.current_state === 'QUESTION_ACTIVE' && sessionData?.session?.question_start_time) {
      const updateElapsed = () => {
        const diff = Math.max(0, Math.floor((Date.now() - sessionData.session.question_start_time) / 1000));
        setElapsedSec(diff);
      };
      updateElapsed();
      const timer = setInterval(updateElapsed, 1000);
      return () => clearInterval(timer);
    }
  }, [sessionData?.session?.current_state, sessionData?.session?.question_start_time]);

  const handleAction = async (action: string) => {
    setLoadingAction(true);
    try {
      const res = await fetch(`/api/sessions/${code}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        await fetchSessionState();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to execute session action');
      }
    } catch (e) {
      alert('Failed to execute session action');
    } finally {
      setLoadingAction(false);
    }
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentState = sessionData?.session?.current_state || 'WAITING';
  const totalQ = sessionData?.total_questions || 5;
  const participantCount = sessionData?.participant_count || 0;
  const completedCount = sessionData?.progress?.completed || 0;
  const leaderboard = sessionData?.leaderboard || [];
  const participants = sessionData?.participants || [];

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-[#F8FAFC] via-white to-[#F1F5F9] text-[#031246] transition-colors">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/organizer/dashboard"
            className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:text-brand-purple hover:bg-slate-200 transition-all cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-brand-purple shadow-sm">
            <Image src="/logo.png" alt="Logo" fill className="object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-brand-purple uppercase">LIVE SESSION CONSOLE</h1>
              <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-brand-purple/10 text-brand-purple border border-brand-purple/30">
                {code}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {sessionData?.quiz_title || 'Loading quiz...'} ({totalQ} Questions)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Open Projector View */}
          <a
            href={`/session/${code}/projector`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-brand-purple hover:bg-brand-purple hover:text-white flex items-center gap-2 transition-all shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Projector View</span>
          </a>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Console Content */}
      <div className="max-w-6xl mx-auto py-8 space-y-8">

        {/* ----------------------------------------------------------------- */}
        {/* 1. WAITING ROOM STAGE                                            */}
        {/* ----------------------------------------------------------------- */}
        {currentState === 'WAITING' && (
          <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-xl text-center space-y-6">
            <div className="max-w-md mx-auto space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-purple/10 text-brand-purple font-bold text-xs uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" /> Lobby Active
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-brand-navy">
                Waiting for Participants
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Direct students to open the quiz portal and enter Game Code:
              </p>
              <div className="py-2">
                <span className="text-4xl sm:text-5xl font-mono font-black tracking-widest text-brand-purple">
                  {code}
                </span>
              </div>
            </div>

            {/* Quick Joined Count */}
            <div className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-700">
              <Users className="w-4 h-4 text-brand-purple" />
              <span>
                <strong>{participantCount}</strong> participant{participantCount === 1 ? '' : 's'} joined
              </span>
            </div>

            {/* Big Green START LIVE QUIZ Button */}
            <div className="pt-2">
              <button
                onClick={() => handleAction('START_QUIZ')}
                disabled={loadingAction}
                className="px-8 py-4 rounded-2xl font-black text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl hover:shadow-emerald-600/25 transition-all active:scale-95 cursor-pointer inline-flex items-center gap-3"
              >
                <Play className="w-5 h-5 fill-white" />
                <span>{loadingAction ? 'Starting Quiz...' : 'START LIVE QUIZ'}</span>
              </button>
              <p className="text-[11px] text-slate-500 mt-2">
                Participants answer questions at their own speed. Late arrivals can join anytime while active.
              </p>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* 2. LIVE QUIZ IN PROGRESS STAGE (Playground Mode)                  */}
        {/* ----------------------------------------------------------------- */}
        {currentState === 'QUESTION_ACTIVE' && (
          <div className="space-y-6">
            {/* Live Control Banner */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-600">
                    LIVE QUIZ IN PROGRESS
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-brand-navy mt-1">
                  Students Are Answering Questions
                </h2>
                <p className="text-xs text-slate-500">
                  Self-paced / Playground mode: All questions are live. Standings update in real time.
                </p>
              </div>

              {/* Conclude Quiz Action */}
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      'Are you sure you want to conclude the quiz session? This will immediately lock submissions and display final rankings.'
                    )
                  ) {
                    handleAction('END_QUIZ');
                  }
                }}
                disabled={loadingAction}
                className="px-6 py-3 rounded-2xl font-black text-xs bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 shadow-lg hover:shadow-rose-600/25 transition-all active:scale-95 cursor-pointer"
              >
                <Ban className="w-4 h-4" />
                <span>{loadingAction ? 'Concluding...' : 'END QUIZ NOW'}</span>
              </button>
            </div>

            {/* Metrics Dashboard Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-1">
                  Participants
                </span>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-purple" />
                  <span className="text-2xl font-black text-brand-navy">{participantCount}</span>
                </div>
                <span className="text-[10px] text-slate-500">Joined in room</span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-1">
                  Finished
                </span>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className="text-2xl font-black text-emerald-600">
                    {completedCount}
                    <span className="text-sm text-slate-400 font-bold"> / {participantCount}</span>
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  {participantCount > 0 ? Math.round((completedCount / participantCount) * 100) : 0}% completed
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-1">
                  Active Time
                </span>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <span className="text-2xl font-mono font-black text-brand-navy">
                    {formatElapsed(elapsedSec)}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">Elapsed session time</span>
              </div>

              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 block mb-1">
                  Questions
                </span>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-indigo" />
                  <span className="text-2xl font-black text-brand-navy">{totalQ}</span>
                </div>
                <span className="text-[10px] text-slate-500">Total single-choice MCQs</span>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* 3. FINAL RESULTS & EXPORTS STAGE                                 */}
        {/* ----------------------------------------------------------------- */}
        {(currentState === 'FINAL_RESULTS' || currentState === 'COMPLETED') && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs uppercase tracking-wider mb-1">
                  <Trophy className="w-3.5 h-3.5" /> Session Concluded
                </div>
                <h2 className="text-2xl font-black text-brand-navy">
                  Quiz Concluded — Final Standings
                </h2>
                <p className="text-xs text-slate-500">
                  Official scores, ranks, and tie-breaking response times are finalized.
                </p>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  href={`/organizer/history/${code}`}
                  className="px-3.5 py-2 rounded-xl bg-brand-purple hover:bg-[#6A1694] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Analytics</span>
                </Link>
                <a
                  href={`/api/sessions/${code}/export/csv`}
                  download
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </a>
                <a
                  href={`/api/sessions/${code}/export/excel`}
                  download
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </a>
                <a
                  href={`/api/sessions/${code}/export/pdf`}
                  download
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </a>
              </div>
            </div>

            {/* Top 3 Winners Podium */}
            {leaderboard.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1st Place Gold */}
                {leaderboard[0] && (
                  <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-50 to-amber-100/60 border-2 border-amber-400 shadow-md text-center order-1 sm:order-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-amber-500 text-white flex items-center justify-center font-black text-xl mb-3 shadow-md">
                      🥇 1
                    </div>
                    <h3 className="font-extrabold text-base text-slate-900 truncate">
                      {leaderboard[0].name}
                    </h3>
                    <p className="text-xs font-mono text-slate-600">{leaderboard[0].roll_no}</p>
                    <div className="mt-3 inline-block px-3 py-1 rounded-full bg-amber-500/20 text-amber-800 font-black text-sm">
                      {leaderboard[0].total_score} pts
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {(leaderboard[0].total_response_time_ms / 1000).toFixed(2)}s total
                    </p>
                  </div>
                )}

                {/* 2nd Place Silver */}
                {leaderboard[1] && (
                  <div className="p-6 rounded-2xl bg-slate-100 border border-slate-200 shadow-sm text-center order-2 sm:order-1">
                    <div className="w-10 h-10 mx-auto rounded-full bg-slate-400 text-white flex items-center justify-center font-black text-lg mb-3">
                      🥈 2
                    </div>
                    <h3 className="font-extrabold text-sm text-slate-800 truncate">
                      {leaderboard[1].name}
                    </h3>
                    <p className="text-xs font-mono text-slate-600">{leaderboard[1].roll_no}</p>
                    <div className="mt-3 inline-block px-3 py-1 rounded-full bg-slate-200 text-slate-800 font-black text-xs">
                      {leaderboard[1].total_score} pts
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {(leaderboard[1].total_response_time_ms / 1000).toFixed(2)}s total
                    </p>
                  </div>
                )}

                {/* 3rd Place Bronze */}
                {leaderboard[2] && (
                  <div className="p-6 rounded-2xl bg-orange-50 border border-orange-200 shadow-sm text-center order-3">
                    <div className="w-10 h-10 mx-auto rounded-full bg-amber-700 text-white flex items-center justify-center font-black text-lg mb-3">
                      🥉 3
                    </div>
                    <h3 className="font-extrabold text-sm text-slate-800 truncate">
                      {leaderboard[2].name}
                    </h3>
                    <p className="text-xs font-mono text-slate-600">{leaderboard[2].roll_no}</p>
                    <div className="mt-3 inline-block px-3 py-1 rounded-full bg-orange-100 text-amber-900 font-black text-xs">
                      {leaderboard[2].total_score} pts
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {(leaderboard[2].total_response_time_ms / 1000).toFixed(2)}s total
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------- */}
        {/* 4. REAL-TIME LEADERBOARD & PARTICIPANT MONITORING                */}
        {/* ----------------------------------------------------------------- */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-brand-purple" />
              <h3 className="text-base font-black tracking-tight text-brand-navy">
                {currentState === 'WAITING' ? 'Joined Participants' : 'Live Leaderboard & Standings'} (
                {leaderboard.length || participants.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {currentState === 'WAITING'
                ? 'Waiting for start'
                : 'Server-authoritative tie breaking: Points DESC, Time ASC'}
            </span>
          </div>

          {(leaderboard.length === 0 && participants.length === 0) ? (
            <div className="text-center py-12 text-xs text-slate-500">
              No participants have joined yet. Share Game Code <strong>{code}</strong> with students.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <th className="py-3 px-3 text-center w-14">Rank</th>
                    <th className="py-3 px-3">Participant</th>
                    <th className="py-3 px-3">Roll No</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3 text-center">Score</th>
                    <th className="py-3 px-3 text-center">Total Time</th>
                    <th className="py-3 px-3 text-center">Anti-Cheat Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(leaderboard.length > 0 ? leaderboard : participants).map((p: any, idx: number) => {
                    const isRemoved = p.status === 'removed';
                    const isWarn2 = p.status === 'warning_2';
                    const isWarn1 = p.status === 'warning_1';
                    const rank = p.rank || idx + 1;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-3 text-center font-bold">
                          {rank === 1 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white font-black text-xs shadow-sm">
                              1
                            </span>
                          ) : rank === 2 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-400 text-white font-black text-xs">
                              2
                            </span>
                          ) : rank === 3 ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white font-black text-xs">
                              3
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono font-bold">#{rank}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900">{p.name}</td>
                        <td className="py-3 px-3 font-mono text-slate-600">{p.roll_no}</td>
                        <td className="py-3 px-3 text-slate-600">{p.department}</td>
                        <td className="py-3 px-3 text-center font-black text-brand-purple text-sm">
                          {p.total_score ?? p.score ?? 0} pts
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-slate-500">
                          {p.total_response_time_ms ? `${(p.total_response_time_ms / 1000).toFixed(2)}s` : '—'}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isRemoved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <Ban className="w-3 h-3" /> REMOVED (3 Strikes)
                            </span>
                          ) : isWarn2 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3" /> Warning 2/3
                            </span>
                          ) : isWarn1 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3" /> Warning 1/3
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Active & Clean
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
