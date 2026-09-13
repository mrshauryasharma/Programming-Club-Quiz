'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import QRCode from 'qrcode';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import {
  Users,
  Clock,
  Trophy,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Award,
  Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ProjectorViewPage() {
  const params = useParams();
  const code = (params.code as string)?.toUpperCase();

  const [sessionState, setSessionState] = useState<any>(null);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [questionSummary, setQuestionSummary] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [progress, setProgress] = useState<{ total: number; completed: number }>({ total: 0, completed: 0 });

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timerRemainingSec, setTimerRemainingSec] = useState<number>(30);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate Join QR Code for mobile participants
  useEffect(() => {
    if (code) {
      const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const joinUrl = `${appUrl}/?code=${code}`;

      QRCode.toDataURL(joinUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#031246',
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error('Error generating QR code:', err));
    }
  }, [code]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const fetchProjectorState = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${code}/state`);
      if (!res.ok) return;
      const data = await res.json();

      setSessionState(data.session);
      setActiveQuestion(data.activeQuestion);
      setQuestionSummary(data.questionSummary);
      setParticipantCount(data.participant_count || 0);
      if (data.leaderboard) setLeaderboard(data.leaderboard);
      if (data.progress) setProgress(data.progress);

      if (data.activeQuestion?.remaining_ms !== undefined) {
        setTimerRemainingSec(Math.ceil(data.activeQuestion.remaining_ms / 1000));
      }

      if (data.session.current_state === 'FINAL_RESULTS' || data.session.current_state === 'COMPLETED') {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 } });
      }
    } catch (e) {}
  }, [code]);

  useEffect(() => {
    fetchProjectorState();
    const interval = setInterval(fetchProjectorState, 3000);

    // Supabase Realtime Channel
    const supabase = getSupabaseBrowserClient();
    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel(`session_${code}`)
        .on('broadcast', { event: 'STATE_CHANGE' }, () => fetchProjectorState())
        .on('broadcast', { event: 'PARTICIPANT_JOINED' }, () => fetchProjectorState())
        .on('broadcast', { event: 'QUESTION_STARTED' }, () => fetchProjectorState())
        .on('broadcast', { event: 'QUESTION_ENDED' }, () => fetchProjectorState())
        .on('broadcast', { event: 'SHOW_LEADERBOARD' }, () => fetchProjectorState())
        .on('broadcast', { event: 'FINAL_RESULTS' }, () => fetchProjectorState())
        .subscribe();
    }

    // SSE fallback
    const eventSource = new EventSource(`/api/sessions/${code}/events`);
    eventSource.onmessage = () => fetchProjectorState();

    return () => {
      clearInterval(interval);
      if (channel && supabase) supabase.removeChannel(channel);
      eventSource.close();
    };
  }, [code, fetchProjectorState]);

  // Local timer decrement
  useEffect(() => {
    if (sessionState?.current_state === 'QUESTION_ACTIVE') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimerRemainingSec((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [sessionState?.current_state]);

  const currentState = sessionState?.current_state || 'WAITING';

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 sm:p-10 bg-[#F7F4FE] dark:bg-[#020205] text-[#031246] dark:text-[#F7F4FE] transition-colors">
      {/* Top Projector Header */}
      <header className="flex items-center justify-between pb-6 border-b border-slate-300 dark:border-brand-cardBorderDark">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-brand-purple shadow-md">
            <Image src="/logo.png" alt="Programming Club Logo" fill className="object-contain" priority />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-brand-purple uppercase">
              USICT GBU PROGRAMMING CLUB
            </h1>
            <p className="text-xs sm:text-sm font-semibold tracking-widest text-slate-500 dark:text-slate-400">
              LEARN • CONNECT • EXPLORE • GROW
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Active Participants Badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-brand-purple/10 dark:bg-brand-purple/20 border border-brand-purple/30 text-brand-purple font-bold text-sm">
            <Users className="w-5 h-5" />
            <span>{participantCount} Joined</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-white dark:bg-brand-cardDark border border-slate-300 dark:border-brand-cardBorderDark text-slate-700 dark:text-slate-300 hover:text-brand-purple transition-all"
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Presentation Stage */}
      <div className="my-auto py-6">
        {/* -------------------------------------------------------- */}
        {/* 1. LOBBY / WAITING STAGE (Large QR Code + Game Code) */}
        {/* -------------------------------------------------------- */}
        {currentState === 'WAITING' && (
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10 p-8 sm:p-12 rounded-3xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-2xl backdrop-blur-md">
            <div className="text-center md:text-left space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" /> Join Live Quiz
              </div>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight">
                Scan QR or Enter Game Code
              </h2>
              <p className="text-slate-600 dark:text-brand-slate text-base">
                Use your phone camera or visit the quiz portal to enter.
              </p>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#080E2B] border border-slate-200 dark:border-brand-cardBorderDark inline-block">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-bold block mb-1">
                  Game Code
                </span>
                <span className="text-5xl sm:text-6xl font-mono font-black tracking-widest text-brand-purple">
                  {code}
                </span>
              </div>
            </div>

            {/* High-Resolution QR Code */}
            <div className="shrink-0 p-4 bg-white rounded-3xl border-4 border-brand-purple shadow-xl">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="Join QR Code" className="w-64 h-64 sm:w-72 sm:h-72" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-slate-400">Loading QR...</div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* 2. QUESTION ACTIVE STAGE (Live Playground Room Standings) */}
        {/* -------------------------------------------------------- */}
        {currentState === 'QUESTION_ACTIVE' && (
          <div className="max-w-6xl mx-auto space-y-8">
            {/* Top Live Banner */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-3xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-xl">
              <div className="flex items-center gap-3">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                </span>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-brand-navy dark:text-white uppercase tracking-tight">
                    LIVE QUIZ IN PROGRESS
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Students are answering questions live • Standings update in real time
                  </p>
                </div>
              </div>

              {/* Room Progress Pill */}
              <div className="flex items-center gap-4">
                <div className="px-5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm sm:text-base">
                  🏁 {progress.completed} of {participantCount} Finished
                </div>
              </div>
            </div>

            {/* Main Stage: Leaderboard + Join QR Code */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Leaderboard Table (2 Columns) */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-xl">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-brand-cardBorderDark">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-black tracking-tight text-brand-navy dark:text-white uppercase">
                    Current Leaderboard
                  </h3>
                </div>

                {leaderboard.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-sm">
                    Scores will appear here as participants submit answers...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaderboard.slice(0, 8).map((p: any, idx: number) => {
                      const rank = p.rank || idx + 1;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#080E2B]/60 border border-slate-200 dark:border-brand-cardBorderDark/50"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs ${
                                rank === 1
                                  ? 'bg-amber-500 text-white shadow-md'
                                  : rank === 2
                                  ? 'bg-slate-400 text-white'
                                  : rank === 3
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {rank}
                            </span>
                            <span className="font-extrabold text-sm sm:text-base text-brand-navy dark:text-white">
                              {p.name}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">({p.department})</span>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="text-xs text-slate-400 font-mono">
                              {p.total_response_time_ms ? `${(p.total_response_time_ms / 1000).toFixed(1)}s` : ''}
                            </span>
                            <span className="text-base font-black text-brand-purple">
                              {p.total_score ?? p.score ?? 0} pts
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Join QR Card for Late Arrivals */}
              <div className="p-6 rounded-3xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-xl text-center space-y-3">
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-brand-purple block">
                  Join Active Quiz
                </span>
                <div className="p-3 bg-white rounded-2xl border-2 border-brand-purple inline-block shadow-md">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="Join QR Code" className="w-44 h-44 mx-auto" />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-slate-400 text-xs">
                      Loading QR...
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Game Code</span>
                  <span className="text-2xl font-mono font-black tracking-widest text-brand-purple">{code}</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Late participants can scan and begin from Question 1.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* 3. QUESTION ENDED / LIVE ANSWER DISTRIBUTION STAGE */}
        {/* -------------------------------------------------------- */}
        {currentState === 'QUESTION_ENDED' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="text-center">
              <span className="px-5 py-2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm uppercase tracking-wider border border-emerald-500/30">
                Time Expired • Question Results
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold mt-3">
                {activeQuestion?.question_text}
              </h2>
            </div>

            {/* Options with Correct Highlight and Answer Distribution */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {activeQuestion?.options.map((option: string, idx: number) => {
                const letters = ['A', 'B', 'C', 'D'];
                const isCorrect = activeQuestion.correct_option_index === idx;
                const count = questionSummary?.option_counts?.[idx] || 0;
                const totalAns = questionSummary?.total_answers || 1;
                const pct = Math.round((count / Math.max(1, totalAns)) * 100);

                return (
                  <div
                    key={idx}
                    className={`p-6 rounded-2xl border transition-all ${
                      isCorrect
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-lg'
                        : 'bg-white/80 dark:bg-brand-cardDark/80 border-slate-200 dark:border-brand-cardBorderDark opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-10 h-10 rounded-xl font-black text-lg flex items-center justify-center shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {letters[idx]}
                        </span>
                        <span className="text-base sm:text-lg font-bold">{option}</span>
                      </div>
                      {isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />}
                    </div>

                    {/* Distribution Bar */}
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCorrect ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1.5">
                      <span>{count} answers</span>
                      <span>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fastest Answer highlight */}
            {questionSummary?.fastest_participant_name && (
              <div className="p-4 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-700 dark:text-amber-300 text-center font-bold text-sm flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>
                  Fastest Correct Answer:{' '}
                  <strong className="font-extrabold">{questionSummary.fastest_participant_name}</strong> in{' '}
                  {(questionSummary.fastest_answer_ms / 1000).toFixed(2)}s
                </span>
              </div>
            )}
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* 4. LEADERBOARD STAGE (Podium + Rank Table) */}
        {/* -------------------------------------------------------- */}
        {(currentState === 'SHOW_LEADERBOARD' || currentState === 'FINAL_RESULTS' || currentState === 'COMPLETED') && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold text-sm uppercase">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>
                  {currentState === 'SHOW_LEADERBOARD' ? 'Current Standings' : 'Final Official Results'}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black mt-2">Leaderboard</h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Score (+2/0) • Ties broken by fastest total valid response time
              </p>
            </div>

            {/* Podium Top 3 */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 items-end pt-6">
              {/* #2 Rank */}
              {leaderboard[1] && (
                <div className="p-4 sm:p-6 rounded-2xl bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-center order-1 h-44 sm:h-52 flex flex-col justify-end">
                  <span className="w-8 h-8 mx-auto rounded-full bg-slate-400 text-slate-900 font-bold flex items-center justify-center mb-2">
                    2
                  </span>
                  <p className="font-bold text-sm sm:text-base truncate">{leaderboard[1].name}</p>
                  <p className="text-xl sm:text-2xl font-black text-brand-purple mt-1">
                    {leaderboard[1].total_score} pts
                  </p>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {(leaderboard[1].total_response_time_ms / 1000).toFixed(1)}s
                  </span>
                </div>
              )}

              {/* #1 Rank (Champion) */}
              {leaderboard[0] && (
                <div className="p-5 sm:p-8 rounded-3xl bg-amber-500/10 dark:bg-amber-500/15 border-2 border-amber-400 text-center order-2 h-56 sm:h-64 flex flex-col justify-end shadow-xl">
                  <Award className="w-10 h-10 mx-auto text-amber-500 mb-1 animate-bounce" />
                  <span className="w-9 h-9 mx-auto rounded-full bg-amber-400 text-slate-900 font-black text-lg flex items-center justify-center mb-2">
                    1
                  </span>
                  <p className="font-extrabold text-base sm:text-lg truncate">{leaderboard[0].name}</p>
                  <p className="text-3xl sm:text-4xl font-black text-amber-500 mt-1">
                    {leaderboard[0].total_score} pts
                  </p>
                  <span className="text-xs text-slate-500 font-mono font-bold">
                    {(leaderboard[0].total_response_time_ms / 1000).toFixed(1)}s
                  </span>
                </div>
              )}

              {/* #3 Rank */}
              {leaderboard[2] && (
                <div className="p-4 sm:p-6 rounded-2xl bg-amber-800/10 dark:bg-amber-950/40 border border-amber-700/40 text-center order-3 h-36 sm:h-44 flex flex-col justify-end">
                  <span className="w-8 h-8 mx-auto rounded-full bg-amber-700 text-white font-bold flex items-center justify-center mb-2">
                    3
                  </span>
                  <p className="font-bold text-sm sm:text-base truncate">{leaderboard[2].name}</p>
                  <p className="text-xl sm:text-2xl font-black text-brand-purple mt-1">
                    {leaderboard[2].total_score} pts
                  </p>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {(leaderboard[2].total_response_time_ms / 1000).toFixed(1)}s
                  </span>
                </div>
              )}
            </div>

            {/* Ranks 4 to 10 Table */}
            {leaderboard.length > 3 && (
              <div className="space-y-2 pt-4">
                {leaderboard.slice(3, 10).map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-white/90 dark:bg-brand-cardDark/90 border border-slate-200 dark:border-brand-cardBorderDark text-sm font-semibold"
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-mono font-bold text-xs">
                        {p.rank}
                      </span>
                      <span>{p.name}</span>
                      <span className="text-xs text-slate-400 font-normal">({p.department})</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-xs text-slate-500 font-mono">
                        {(p.total_response_time_ms / 1000).toFixed(1)}s
                      </span>
                      <span className="font-extrabold text-brand-purple text-base">{p.total_score} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <footer className="pt-6 border-t border-slate-300 dark:border-brand-cardBorderDark flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
        <p>SOICT • Gautam Buddha University</p>
        <p className="font-mono font-bold tracking-widest text-brand-purple">GAME CODE: {code}</p>
      </footer>
    </div>
  );
}
