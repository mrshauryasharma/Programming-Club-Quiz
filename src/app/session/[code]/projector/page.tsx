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
    <div className="min-h-screen flex flex-col justify-between p-6 sm:p-10 bg-gradient-to-b from-[#F8FAFC] via-white to-[#F1F5F9] text-[#031246] transition-colors">
      {/* Top Projector Header */}
      <header className="flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-brand-purple shadow-md">
            <Image src="/logo.png" alt="Programming Club Logo" fill className="object-contain" priority />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-brand-purple uppercase">
              USICT GBU PROGRAMMING CLUB
            </h1>
            <p className="text-xs sm:text-sm font-semibold tracking-widest text-slate-500">
              LEARN • CONNECT • EXPLORE • GROW
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Active Participants Badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-brand-purple/10 border border-brand-purple/30 text-brand-purple font-bold text-sm">
            <Users className="w-5 h-5" />
            <span>{participantCount} Joined</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:text-brand-purple hover:bg-slate-200 transition-all cursor-pointer"
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
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10 p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 shadow-2xl">
            <div className="text-center md:text-left space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-purple/10 text-brand-purple font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4" /> Join Live Quiz
              </div>
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight text-brand-navy">
                Scan QR or Enter Game Code
              </h2>
              <p className="text-slate-600 text-base">
                Use your phone camera or visit the quiz portal to enter.
              </p>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 inline-block shadow-sm">
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-xl">
              <div className="flex items-center gap-3">
                <span className="relative flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
                </span>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-brand-navy uppercase tracking-tight">
                    LIVE QUIZ IN PROGRESS
                  </h2>
                  <p className="text-xs text-slate-500">
                    Students are answering questions live • Standings update in real time
                  </p>
                </div>
              </div>

              {/* Room Progress Pill */}
              <div className="flex items-center gap-4">
                <div className="px-5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-extrabold text-sm sm:text-base">
                  🏁 {progress.completed} of {participantCount} Finished
                </div>
              </div>
            </div>

            {/* Main Stage: Leaderboard + Join QR Code */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Leaderboard Table (2 Columns) */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200 shadow-xl">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="text-lg font-black tracking-tight text-brand-navy uppercase">
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
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200"
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
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {rank}
                            </span>
                            <span className="font-extrabold text-sm sm:text-base text-brand-navy">
                              {p.name}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">({p.department})</span>
                          </div>

                          <div className="flex items-center gap-4">
                            <span className="text-xs text-slate-500 font-mono">
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
              <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xl text-center space-y-3">
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
                <p className="text-[11px] text-slate-500 leading-tight">
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
              <span className="px-5 py-2 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-sm uppercase tracking-wider border border-emerald-200">
                Time Expired • Question Results
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold mt-3 text-brand-navy">
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
                        ? 'bg-emerald-50 border-emerald-500 shadow-lg'
                        : 'bg-white border-slate-200 opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-10 h-10 rounded-xl font-black text-lg flex items-center justify-center shrink-0 ${
                            isCorrect
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {letters[idx]}
                        </span>
                        <span className="text-base sm:text-lg font-bold text-slate-800">{option}</span>
                      </div>
                      {isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />}
                    </div>

                    {/* Distribution Bar */}
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCorrect ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mt-1.5">
                      <span>{count} answers</span>
                      <span>{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Fastest Answer highlight */}
            {questionSummary?.fastest_participant_name && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-800 text-center font-bold text-sm flex items-center justify-center gap-2 shadow-sm">
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
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 font-extrabold text-sm uppercase">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>
                  {currentState === 'SHOW_LEADERBOARD' ? 'Current Standings' : 'Final Official Results'}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black mt-2 text-brand-navy">Leaderboard</h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Score (+2/0) • Ties broken by fastest total valid response time
              </p>
            </div>

            {/* Podium Top 3 */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 items-end pt-6">
              {/* #2 Rank */}
              {leaderboard[1] && (
                <div className="p-4 sm:p-6 rounded-2xl bg-slate-100 border border-slate-200 text-center order-1 h-44 sm:h-52 flex flex-col justify-end shadow-md">
                  <span className="w-8 h-8 mx-auto rounded-full bg-slate-400 text-white font-bold flex items-center justify-center mb-2">
                    2
                  </span>
                  <p className="font-bold text-sm sm:text-base text-slate-800 truncate">{leaderboard[1].name}</p>
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
                <div className="p-5 sm:p-8 rounded-3xl bg-gradient-to-b from-amber-50 to-amber-100/60 border-2 border-amber-400 text-center order-2 h-56 sm:h-64 flex flex-col justify-end shadow-xl">
                  <Award className="w-10 h-10 mx-auto text-amber-500 mb-1 animate-bounce" />
                  <span className="w-9 h-9 mx-auto rounded-full bg-amber-400 text-slate-900 font-black text-lg flex items-center justify-center mb-2">
                    1
                  </span>
                  <p className="font-extrabold text-base sm:text-lg text-slate-900 truncate">{leaderboard[0].name}</p>
                  <p className="text-3xl sm:text-4xl font-black text-amber-600 mt-1">
                    {leaderboard[0].total_score} pts
                  </p>
                  <span className="text-xs text-slate-600 font-mono font-bold">
                    {(leaderboard[0].total_response_time_ms / 1000).toFixed(1)}s
                  </span>
                </div>
              )}

              {/* #3 Rank */}
              {leaderboard[2] && (
                <div className="p-4 sm:p-6 rounded-2xl bg-orange-50 border border-orange-200 text-center order-3 h-36 sm:h-44 flex flex-col justify-end shadow-md">
                  <span className="w-8 h-8 mx-auto rounded-full bg-amber-700 text-white font-bold flex items-center justify-center mb-2">
                    3
                  </span>
                  <p className="font-bold text-sm sm:text-base text-slate-800 truncate">{leaderboard[2].name}</p>
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
                    className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-mono font-bold text-xs border border-slate-200">
                        {p.rank}
                      </span>
                      <span className="text-slate-800">{p.name}</span>
                      <span className="text-xs text-slate-500 font-normal">({p.department})</span>
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
      <footer className="pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
        <p>SOICT • Gautam Buddha University</p>
        <p className="font-mono font-bold tracking-widest text-brand-purple">GAME CODE: {code}</p>
      </footer>
    </div>
  );
}
