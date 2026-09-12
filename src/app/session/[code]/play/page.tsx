'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import {
  WifiOff,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Award,
} from 'lucide-react';

export default function ParticipantPlayPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string)?.toUpperCase();

  // Participant identity
  const [participantId, setParticipantId] = useState('');
  const [participantName, setParticipantName] = useState('');

  // Session & Question state
  const [sessionState, setSessionState] = useState<any>(null);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [questionSummary, setQuestionSummary] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Submission & Local state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [myQuestionIndex, setMyQuestionIndex] = useState<number>(0);
  const [showCompletionScreen, setShowCompletionScreen] = useState(false);

  // Anti-Cheat & Warning state
  const [warningCount, setWarningCount] = useState(0);
  const [isRemoved, setIsRemoved] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState<number | null>(null);

  // Network & System state
  const [isConnected, setIsConnected] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timerRemainingSec, setTimerRemainingSec] = useState<number>(30);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fullscreen helper
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Anti-cheat violation reporter
  const reportViolation = useCallback(
    async (type: string) => {
      // Ignore if disconnected (network loss is NOT cheating) or already removed
      if (!navigator.onLine || isRemoved || !participantId) return;

      try {
        const res = await fetch(`/api/sessions/${code}/violation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participant_id: participantId,
            violation_type: type,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setWarningCount(data.warning_count);
          if (data.is_removed) {
            setIsRemoved(true);
          } else {
            setShowWarningModal(data.warning_count);
          }
        }
      } catch (err) {
        console.warn('Error reporting violation:', err);
      }
    },
    [code, participantId, isRemoved]
  );

  // Initial setup & event listeners
  useEffect(() => {
    const storedId = sessionStorage.getItem('pc_quiz_participant_id');
    const storedName = sessionStorage.getItem('pc_quiz_participant_name');
    const storedCode = sessionStorage.getItem('pc_quiz_session_code');

    // If no participant credentials exist or session code mismatches this route, redirect cleanly to join
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

    // Anti-cheat listeners
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        reportViolation('tab_hidden_or_switched');
      }
    };

    const handleWindowBlur = () => {
      reportViolation('window_blur_or_focus_lost');
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement) {
        reportViolation('fullscreen_exited');
      }
    };

    // Network connection listeners
    const handleOnline = () => {
      setIsConnected(true);
      // Restore state upon reconnection
      fetch(`/api/sessions/${code}/restore?participant_id=${storedId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.participant) {
            setWarningCount(data.participant.warning_count);
            if (data.participant.status === 'removed') setIsRemoved(true);
          }
        })
        .catch(() => {});
    };

    const handleOffline = () => {
      setIsConnected(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state restore check
    fetch(`/api/sessions/${code}/restore?participant_id=${storedId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.participant) {
          setWarningCount(data.participant.warning_count);
          if (data.participant.status === 'removed') setIsRemoved(true);
        } else {
          // Stored participant is not in this session; clean storage and redirect to join
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('pc_quiz_participant_id');
            sessionStorage.removeItem('pc_quiz_participant_name');
            sessionStorage.removeItem('pc_quiz_session_code');
          }
          router.push(`/?code=${code}`);
        }
      })
      .catch(() => {});

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [code, router, reportViolation]);

  // Poll state and sync with Supabase Realtime
  const fetchCurrentState = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${code}/state`);
      if (!res.ok) return;
      const data = await res.json();
      setSessionState(data.session);
      setActiveQuestion(data.activeQuestion);
      setQuestionSummary(data.questionSummary);
      if (data.leaderboard) setLeaderboard(data.leaderboard);

      // Load questions array from server
      if (data.questions && data.questions.length > 0) {
        setQuestionsList((prev) => {
          if (prev.length === 0) {
            let restoreIndex = 0;
            for (let i = 0; i < data.questions.length; i++) {
              const q = data.questions[i];
              if (sessionStorage.getItem(`pc_ans_${code}_${q.id}`)) {
                restoreIndex = i + 1;
              } else {
                break;
              }
            }
            if (restoreIndex >= data.questions.length) {
              setShowCompletionScreen(true);
            } else {
              setMyQuestionIndex(restoreIndex);
              setTimerRemainingSec(data.questions[restoreIndex]?.timer_seconds || 30);
            }
          }
          return data.questions;
        });
      }

      // Check if this participant was removed
      if (participantId && data.participants) {
        const me = data.participants.find((p: any) => p.id === participantId);
        if (me) {
          setWarningCount(me.warning_count);
          if (me.status === 'removed') setIsRemoved(true);
        }
      }

      // When session reaches FINAL_RESULTS or COMPLETED, show neutral completion
      if (
        data.session.current_state === 'FINAL_RESULTS' ||
        data.session.current_state === 'COMPLETED'
      ) {
        setShowCompletionScreen(true);
      }
    } catch (e) {}
  }, [code, participantId]);

  useEffect(() => {
    fetchCurrentState();
    const interval = setInterval(fetchCurrentState, 2000);

    // Supabase Realtime Channel
    const supabase = getSupabaseBrowserClient();
    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel(`session_${code}`)
        .on('broadcast', { event: 'QUESTION_STARTED' }, () => {
          fetchCurrentState();
        })
        .on('broadcast', { event: 'QUESTION_ENDED' }, () => {
          fetchCurrentState();
        })
        .on('broadcast', { event: 'SHOW_LEADERBOARD' }, () => {
          fetchCurrentState();
        })
        .on('broadcast', { event: 'FINAL_RESULTS' }, () => {
          fetchCurrentState();
        })
        .on('broadcast', { event: 'PARTICIPANT_REMOVED' }, (payload: any) => {
          if (payload.payload?.participant_id === participantId) {
            setIsRemoved(true);
          }
        })
        .subscribe();
    }

    // SSE fallback
    const eventSource = new EventSource(`/api/sessions/${code}/events`);
    eventSource.onmessage = () => fetchCurrentState();
    eventSource.addEventListener('QUESTION_STARTED', () => fetchCurrentState());
    eventSource.addEventListener('QUESTION_ENDED', () => fetchCurrentState());
    eventSource.addEventListener('SHOW_LEADERBOARD', () => fetchCurrentState());
    eventSource.addEventListener('FINAL_RESULTS', () => fetchCurrentState());
    eventSource.addEventListener('PARTICIPANT_REMOVED', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.participant_id === participantId) setIsRemoved(true);
      } catch (err) {}
    });

    return () => {
      clearInterval(interval);
      if (channel && supabase) supabase.removeChannel(channel);
      eventSource.close();
    };
  }, [code, fetchCurrentState, participantId]);

  // Per-question timer countdown tick
  useEffect(() => {
    if (sessionState?.current_state === 'QUESTION_ACTIVE' && !showCompletionScreen) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimerRemainingSec((prev) => {
          if (prev <= 1) {
            // Auto advance to next question when timer runs out
            if (questionsList.length > 0 && myQuestionIndex + 1 < questionsList.length) {
              const nextIndex = myQuestionIndex + 1;
              setMyQuestionIndex(nextIndex);
              setSelectedOption(null);
              setSubmitted(false);
              return questionsList[nextIndex]?.timer_seconds || 30;
            } else if (questionsList.length > 0) {
              setShowCompletionScreen(true);
              return 0;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [sessionState?.current_state, myQuestionIndex, questionsList, showCompletionScreen]);

  // Submit Answer handler — immediately advances participant to next question on success
  const handleOptionSelect = async (index: number) => {
    if (submitted || isRemoved || sessionState?.current_state !== 'QUESTION_ACTIVE') return;

    const currentQ = questionsList[myQuestionIndex] || activeQuestion;
    if (!currentQ?.id) return;

    // Record selection and lock options immediately
    setSelectedOption(index);
    setSubmitted(true);

    // Persist to sessionStorage so refresh/reconnect knows this question was answered
    sessionStorage.setItem(`pc_ans_${code}_${currentQ.id}`, `${index}`);

    try {
      const res = await fetch(`/api/sessions/${code}/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: participantId,
          question_id: currentQ.id,
          selected_option: index,
        }),
      });

      if (res.ok) {
        // Answer persisted on server — advance participant to next question IMMEDIATELY.
        const totalQ = questionsList.length || activeQuestion?.total_questions || 5;

        if (myQuestionIndex + 1 >= totalQ) {
          // Final question completed — show neutral completion screen
          setShowCompletionScreen(true);
        } else {
          // IMMEDIATELY show next question — no waiting screen!
          const nextIndex = myQuestionIndex + 1;
          setMyQuestionIndex(nextIndex);
          setSelectedOption(null);
          setSubmitted(false);
          const nextQ = questionsList[nextIndex];
          setTimerRemainingSec(nextQ?.timer_seconds || 30);
        }
      } else {
        // Server rejected (e.g. session ended) — revert
        setSubmitted(false);
        setSelectedOption(null);
        sessionStorage.removeItem(`pc_ans_${code}_${currentQ.id}`);
        const errData = await res.json().catch(() => ({}));
        console.warn('Answer rejected by server:', errData.error || res.status);
      }
    } catch (err) {
      // Network error — revert
      setSubmitted(false);
      setSelectedOption(null);
      sessionStorage.removeItem(`pc_ans_${code}_${currentQ.id}`);
      console.warn('Error submitting answer:', err);
    }
  };

  // -------------------------------------------------------------
  // STATE: REMOVED SCREEN (Warning 3 strike)
  // -------------------------------------------------------------
  if (isRemoved) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#020205] text-white">
        <div className="w-full max-w-md p-8 rounded-2xl bg-rose-950/40 border border-rose-800 text-center shadow-2xl backdrop-blur-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-900/60 flex items-center justify-center text-rose-400 mb-4 border border-rose-700">
            <Ban className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-rose-400 tracking-tight">REMOVED FROM SESSION</h2>
          <p className="text-xs text-rose-300/80 mt-2 leading-relaxed">
            You have received 3 confirmed anti-cheat warnings (tab switches, window focus loss, or leaving the quiz window).
          </p>
          <div className="my-6 p-4 rounded-xl bg-rose-900/20 border border-rose-800/40 text-left text-xs space-y-2">
            <p className="font-semibold text-rose-200">Session Rules Enforcement:</p>
            <ul className="list-disc pl-4 text-rose-300/70 space-y-1">
              <li>Answering is permanently disabled for this session.</li>
              <li>Your previous score and rankings will no longer apply.</li>
              <li>You cannot rejoin this active session with another tab.</li>
            </ul>
          </div>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                sessionStorage.clear();
                window.location.href = '/';
              } else {
                router.push('/');
              }
            }}
            className="w-full py-3 rounded-xl bg-rose-800 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            Return to Join Screen
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-b from-[#F7F4FE] via-white to-[#EDE8FD] dark:from-[#020205] dark:via-[#030926] dark:to-[#020205] text-[#031246] dark:text-[#F7F4FE]">
      {/* Network Disconnect Warning Banner */}
      {!isConnected && (
        <div className="w-full bg-rose-600 text-white text-xs font-bold py-2 px-4 text-center flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="w-4 h-4 animate-pulse" />
          <span>Connection Lost. Reconnecting to live session... (Normal network loss is not penalized)</span>
        </div>
      )}

      {/* Top Bar */}
      <header className="w-full max-w-2xl mx-auto flex items-center justify-between py-2 border-b border-slate-200 dark:border-brand-cardBorderDark/50">
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-brand-purple/40">
            <Image src="/logo.png" alt="Logo" fill className="object-contain" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-brand-purple">USICT GBU</h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{participantName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="p-1.5 rounded-lg bg-slate-200 dark:bg-brand-cardDark text-slate-700 dark:text-slate-300 hover:text-brand-purple transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Warning Badge */}
          {warningCount > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              <AlertTriangle className="w-3 h-3" />
              <span>
                {warningCount}/3 {warningCount === 1 ? 'Warning' : 'Warnings'}
              </span>
            </div>
          )}

          <ThemeToggle />
        </div>
      </header>

      {/* Anti-Cheat Warning Modal (Warning 1 & 2) */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white dark:bg-[#070E28] border border-amber-500 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tight">
              Anti-Cheat Warning {showWarningModal} of 3
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              You navigated away from the quiz window or switched tabs.
              {showWarningModal === 1 && ' This is your 1st warning. Please remain on this screen.'}
              {showWarningModal === 2 && ' CAUTION: A 3rd violation will cause IMMEDIATE REMOVAL.'}
            </p>
            <button
              onClick={() => setShowWarningModal(null)}
              className="mt-5 w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white transition-colors"
            >
              I Understand & Remain Focused
            </button>
          </div>
        </div>
      )}

      {/* Dynamic State View Container */}
      <div className="w-full max-w-2xl mx-auto my-auto py-4">

        {/* -------------------------------------------------------- */}
        {/* COMPLETION SCREEN — shown immediately after final question submit */}
        {/* OR when server reaches FINAL_RESULTS/COMPLETED state           */}
        {/* -------------------------------------------------------- */}
        {showCompletionScreen && (
          <div className="p-8 rounded-2xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-brand-purple/15 text-brand-purple flex items-center justify-center mb-4 border border-brand-purple/30">
              <Award className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black text-brand-navy dark:text-white">Quiz Completed!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
              Your answers have been recorded.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Please wait for the Organizer to reveal the final results.
            </p>
            <div className="mt-6 w-8 h-8 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* 1. WAITING FOR ORGANIZER TO START (Only before Q1)       */}
        {/* -------------------------------------------------------- */}
        {!showCompletionScreen && sessionState?.current_state === 'WAITING' && (
          <div className="text-center p-8 rounded-2xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-lg">
            <div className="w-12 h-12 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-brand-navy dark:text-white">Waiting for Quiz to Start...</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Organizer will start the quiz shortly. Please remain on this screen.
            </p>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* 2. QUESTION ACTIVE — Immediate Question 1 -> 2 -> 3 ...  */}
        {/* -------------------------------------------------------- */}
        {!showCompletionScreen &&
          sessionState?.current_state !== 'WAITING' &&
          sessionState?.current_state !== 'FINAL_RESULTS' &&
          sessionState?.current_state !== 'COMPLETED' &&
          (questionsList[myQuestionIndex] || activeQuestion) && (
          (() => {
            const currentQ = questionsList[myQuestionIndex] || activeQuestion;
            const totalQ = questionsList.length || activeQuestion?.total_questions || 5;

            return (
              <div className="space-y-4">
                {/* Question Progress & Timer Bar */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-sm">
                  <div className="text-xs font-bold text-brand-purple tracking-wide">
                    Question {myQuestionIndex + 1} of {totalQ}
                  </div>

                  {/* Strict Countdown Timer Display */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold transition-all ${
                      timerRemainingSec <= 5
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{timerRemainingSec}s</span>
                  </div>
                </div>

                {/* Question Card */}
                <div className="p-6 rounded-2xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-lg">
                  <h2 className="text-lg sm:text-xl font-bold leading-snug tracking-tight text-brand-navy dark:text-white">
                    {currentQ.question_text}
                  </h2>
                </div>

                {/* MCQ Answer Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentQ.options.map((option: string, idx: number) => {
                    const isSelected = selectedOption === idx;
                    const optionLetters = ['A', 'B', 'C', 'D'];

                    return (
                      <button
                        key={idx}
                        onClick={() => handleOptionSelect(idx)}
                        disabled={submitted || timerRemainingSec === 0}
                        className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer select-none active:scale-[0.98] ${
                          isSelected
                            ? 'bg-brand-purple text-white border-brand-purple shadow-md scale-[1.01]'
                            : submitted
                            ? 'opacity-60 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                            : 'bg-white/90 dark:bg-brand-cardDark/90 border-slate-300 dark:border-brand-cardBorderDark hover:border-brand-purple/60 hover:bg-brand-purple/5'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected
                              ? 'bg-white text-brand-purple'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {optionLetters[idx]}
                        </span>
                        <span className="text-sm font-medium leading-relaxed mt-0.5">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()
        )}

        {/* -------------------------------------------------------- */}
        {/* FINAL RESULTS / COMPLETED STATE                          */}
        {/* -------------------------------------------------------- */}
        {!showCompletionScreen &&
          (sessionState?.current_state === 'FINAL_RESULTS' ||
            sessionState?.current_state === 'COMPLETED') && (
          <div className="p-8 rounded-2xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-brand-purple/15 text-brand-purple flex items-center justify-center mb-4 border border-brand-purple/30">
              <Award className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black text-brand-navy dark:text-white">Quiz Completed!</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
              Your answers have been recorded.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Please wait for the Organizer to reveal the final results.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full max-w-2xl mx-auto text-center py-2 text-[11px] text-slate-500 dark:text-slate-400">
        <p>USICT GBU Programming Club • LEARN • CONNECT • EXPLORE • GROW</p>
      </footer>
    </main>
  );
}
