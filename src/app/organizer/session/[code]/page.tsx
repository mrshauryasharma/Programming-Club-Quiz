'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import {
  Play,
  Square,
  Trophy,
  ArrowRight,
  ExternalLink,
  Users,
  AlertTriangle,
  Ban,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Clock,
  BarChart3,
} from 'lucide-react';

export default function OrganizerLiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string)?.toUpperCase();

  const [sessionData, setSessionData] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const fetchSessionState = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${code}/state`);
      if (!res.ok) return;
      const data = await res.json();
      setSessionData(data);
    } catch (e) {
      console.error(e);
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
      }
    } catch (e) {
      alert('Failed to execute session action');
    } finally {
      setLoadingAction(false);
    }
  };

  const currentState = sessionData?.session?.current_state || 'WAITING';
  const qIndex = sessionData?.session?.current_question_index ?? 0;
  const totalQ = sessionData?.total_questions || 5;

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-[#F7F4FE] dark:bg-[#020205] text-[#031246] dark:text-[#F7F4FE]">
      {/* Top Header */}
      <header className="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-slate-200 dark:border-brand-cardBorderDark">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden border border-brand-purple">
            <Image src="/logo.png" alt="Logo" fill className="object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-brand-purple uppercase">LIVE SESSION CONSOLE</h1>
              <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-lg bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
                {code}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {sessionData?.quiz_title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Open Projector View */}
          <a
            href={`/session/${code}/projector`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-brand-cardDark border border-slate-300 dark:border-brand-cardBorderDark text-xs font-bold text-brand-purple hover:bg-brand-purple hover:text-white flex items-center gap-2 transition-all shadow-sm"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open Projector View</span>
          </a>

          <ThemeToggle />
        </div>
      </header>

      {/* Control Console */}
      <div className="max-w-6xl mx-auto py-8 space-y-8">
        {/* Action Panel */}
        <div className="p-6 rounded-2xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-md">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Current Session State
              </span>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xl font-black text-brand-purple">{currentState}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  (Question {qIndex + 1} of {totalQ})
                </span>
              </div>
            </div>

            {/* Stage Transition Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {currentState === 'WAITING' && (
                <button
                  onClick={() => handleAction('START_QUESTION')}
                  disabled={loadingAction}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>START QUESTION 1</span>
                </button>
              )}

              {currentState === 'QUESTION_ACTIVE' && (
                <button
                  onClick={() => handleAction('END_QUESTION')}
                  disabled={loadingAction}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Square className="w-4 h-4 fill-white" />
                  <span>END QUESTION NOW</span>
                </button>
              )}

              {currentState === 'QUESTION_ENDED' && (
                <>
                  <button
                    onClick={() => handleAction('SHOW_LEADERBOARD')}
                    disabled={loadingAction}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Trophy className="w-4 h-4" />
                    <span>SHOW LEADERBOARD</span>
                  </button>

                  {qIndex + 1 < totalQ ? (
                    <button
                      onClick={() => handleAction('NEXT_QUESTION')}
                      disabled={loadingAction}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs bg-brand-purple hover:bg-[#6A1694] text-white flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      <span>NEXT QUESTION</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction('FINAL_RESULTS')}
                      disabled={loadingAction}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs bg-brand-indigo hover:bg-brand-navy text-white flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      <Trophy className="w-4 h-4" />
                      <span>SHOW FINAL RESULTS</span>
                    </button>
                  )}
                </>
              )}

              {currentState === 'SHOW_LEADERBOARD' && (
                <>
                  {qIndex + 1 < totalQ ? (
                    <button
                      onClick={() => handleAction('NEXT_QUESTION')}
                      disabled={loadingAction}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs bg-brand-purple hover:bg-[#6A1694] text-white flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      <span>NEXT QUESTION</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction('FINAL_RESULTS')}
                      disabled={loadingAction}
                      className="px-5 py-2.5 rounded-xl font-bold text-xs bg-brand-indigo hover:bg-brand-navy text-white flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      <Trophy className="w-4 h-4" />
                      <span>SHOW FINAL RESULTS</span>
                    </button>
                  )}
                </>
              )}

              {(currentState === 'FINAL_RESULTS' || currentState === 'COMPLETED') && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/organizer/history/${code}`}
                    className="px-3.5 py-2 rounded-xl bg-brand-purple hover:bg-[#6A1694] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>View Analytics & Report</span>
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
              )}
            </div>
          </div>

          {/* Current Question Display */}
          {sessionData?.activeQuestion && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#080E2B] border border-slate-200 dark:border-brand-cardBorderDark text-xs">
              <span className="font-bold text-slate-500 uppercase">Question Text:</span>
              <p className="text-sm font-bold mt-0.5 text-brand-navy dark:text-white">
                {sessionData.activeQuestion.question_text}
              </p>
            </div>
          )}
        </div>

        {/* Live Participant Monitoring Table */}
        <div className="p-6 rounded-2xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-md">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-purple" />
              <h3 className="text-lg font-bold">Participants ({sessionData?.participant_count || 0})</h3>
            </div>
            <span className="text-xs text-slate-500">Live monitoring & anti-cheat status</span>
          </div>

          {!sessionData?.participants || sessionData.participants.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500">
              No participants have joined yet. Tell students to enter Game Code: <strong>{code}</strong>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-brand-cardBorderDark text-slate-500 dark:text-slate-400 uppercase font-semibold">
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Roll No</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3 text-center">Score</th>
                    <th className="py-2.5 px-3 text-center">Anti-Cheat Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-brand-cardBorderDark/40 font-medium">
                  {sessionData.participants.map((p: any) => {
                    const isRemoved = p.status === 'removed';
                    const isWarn2 = p.status === 'warning_2';
                    const isWarn1 = p.status === 'warning_1';

                    return (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-[#080E2B]">
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="py-3 px-3 font-mono">{p.roll_no}</td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400">{p.department}</td>
                        <td className="py-3 px-3 text-center font-bold text-brand-purple">
                          {p.total_score} pts
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isRemoved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                              <Ban className="w-3 h-3" /> REMOVED (3 Strikes)
                            </span>
                          ) : isWarn2 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <AlertTriangle className="w-3 h-3" /> Warning 2 of 3
                            </span>
                          ) : isWarn1 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3" /> Warning 1 of 3
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
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
