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
  LogOut,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const lastViolationTimeRef = useRef<number>(0);
  const isWarningModalOpenRef = useRef<boolean>(false);
  const questionStartTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    isWarningModalOpenRef.current = showWarningModal !== null;
  }, [showWarningModal]);

  // Clean exit helper
  const handleExitQuiz = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pc_quiz_participant_id');
      sessionStorage.removeItem('pc_quiz_participant_name');
      sessionStorage.removeItem('pc_quiz_session_code');
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('pc_ans_')) sessionStorage.removeItem(k);
      });
    }
    router.push('/');
  };

  // Anti-cheat violation reporter
  const reportViolation = useCallback(
    async (type: string) => {
      // Ignore if disconnected, already removed, or warning modal is currently open waiting for user acknowledgement
      if (!navigator.onLine || isRemoved || !participantId || isWarningModalOpenRef.current) return;

      // Throttle/debounce within 3000ms so a single tab switch does not fire both blur and visibilitychange
      const now = Date.now();
      if (now - lastViolationTimeRef.current < 3000) return;
      lastViolationTimeRef.current = now;

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

  const fetchCurrentState = useCallback(async () => {
    try {
      const effectivePid = participantId || (typeof window !== 'undefined' ? sessionStorage.getItem('pc_quiz_participant_id') : '') || '';
      const pParam = effectivePid ? `participant_id=${encodeURIComponent(effectivePid)}` : '';
      const tParam = `_t=${Date.now()}`;
      const queryStr = `?${[pParam, tParam].filter(Boolean).join('&')}`;
      const res = await fetch(`/api/sessions/${code}/state${queryStr}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      });
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
            const serverAnswered: string[] = data.answered_question_ids || [];
            let restoreIndex = 0;
            for (let i = 0; i < data.questions.length; i++) {
              const q = data.questions[i];
              const isAnsweredOnServer = serverAnswered.includes(q.id);
              const isAnsweredInStorage =
                typeof window !== 'undefined' &&
                effectivePid &&
                sessionStorage.getItem(`pc_ans_${code}_${effectivePid}_${q.id}`) !== null;

              if (isAnsweredOnServer || isAnsweredInStorage) {
                restoreIndex = i + 1;
              } else {
                break;
              }
            }

            if (restoreIndex >= data.questions.length) {
              setShowCompletionScreen(true);
            } else {
              setMyQuestionIndex((prevIdx) => Math.max(prevIdx, restoreIndex));
              questionStartTimeRef.current = Date.now();
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
    const interval = setInterval(fetchCurrentState, 3000);

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

  // Prevent browser back button navigation to previous questions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', window.location.href);
      const handlePopState = () => {
        window.history.pushState(null, '', window.location.href);
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, []);

  // Per-question timer countdown tick
  useEffect(() => {
    const isQuizActive =
      !showCompletionScreen &&
      sessionState?.current_state !== 'WAITING' &&
      sessionState?.current_state !== 'FINAL_RESULTS' &&
      sessionState?.current_state !== 'COMPLETED';

    if (isQuizActive) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimerRemainingSec((prev) => {
          if (prev <= 1) {
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
  }, [sessionState?.current_state, showCompletionScreen]);

  // Handle timer running out (0s): auto advance and record timeout so student cannot go back
  useEffect(() => {
    if (timerRemainingSec === 0 && !showCompletionScreen && questionsList.length > 0) {
      const currentQ = questionsList[myQuestionIndex] || activeQuestion;
      const totalQ = questionsList.length || activeQuestion?.total_questions || 5;
      const effectivePid =
        participantId ||
        (typeof window !== 'undefined' ? sessionStorage.getItem('pc_quiz_participant_id') : '') ||
        '';

      if (currentQ?.id && effectivePid) {
        sessionStorage.setItem(
          `pc_ans_${code}_${effectivePid}_${currentQ.id}`,
          selectedOption !== null ? `${selectedOption}` : 'timeout'
        );

        if (selectedOption !== null) {
          fetch(`/api/sessions/${code}/submit-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              participant_id: effectivePid,
              question_id: currentQ.id,
              selected_option: selectedOption,
              response_time_ms: (currentQ.timer_seconds || 30) * 1000,
            }),
          }).catch(() => {});
        }
      }

      if (myQuestionIndex + 1 >= totalQ) {
        setSubmitted(true);
        setShowCompletionScreen(true);
      } else {
        const nextIndex = myQuestionIndex + 1;
        setMyQuestionIndex(nextIndex);
        setSelectedOption(null);
        questionStartTimeRef.current = Date.now();
        const nextQ = questionsList[nextIndex];
        setTimerRemainingSec(nextQ?.timer_seconds || 30);
      }
    }
  }, [timerRemainingSec, showCompletionScreen, questionsList, myQuestionIndex, activeQuestion, code, participantId, selectedOption]);

  // Option selection: selects the option so student can change before confirming
  const handleOptionSelect = (index: number) => {
    if (isSubmitting || submitted || isRemoved) return;
    setSelectedOption(index);
  };

  // Confirm and submit the answer — locks in answer and advances to next question (CANNOT GO BACK!)
  const handleConfirmSubmit = async () => {
    if (selectedOption === null || isSubmitting || submitted || isRemoved) return;

    const currentQ = questionsList[myQuestionIndex] || activeQuestion;
    if (!currentQ?.id) return;

    setIsSubmitting(true);
    const chosenIndex = selectedOption;
    const effectivePid =
      participantId ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('pc_quiz_participant_id') : '') ||
      '';

    // Measure exact time spent on this question
    const timeSpentMs = Math.max(150, Date.now() - questionStartTimeRef.current);

    // Persist to sessionStorage scoped by participantId so refresh/reconnect permanently locks this question
    if (typeof window !== 'undefined' && effectivePid) {
      sessionStorage.setItem(`pc_ans_${code}_${effectivePid}_${currentQ.id}`, `${chosenIndex}`);
    }

    const totalQ = questionsList.length || activeQuestion?.total_questions || 5;

    // Send answer to server in background
    try {
      if (effectivePid) {
        fetch(`/api/sessions/${code}/submit-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            participant_id: effectivePid,
            question_id: currentQ.id,
            selected_option: chosenIndex,
            response_time_ms: timeSpentMs,
          }),
        }).catch((err) => {
          console.warn('Background answer submit failed:', err);
        });
      }
    } catch (err) {
      console.warn('Error submitting answer:', err);
    }

    // Advance to next question — PREVIOUS QUESTION IS PERMANENTLY LOCKED
    if (myQuestionIndex + 1 >= totalQ) {
      setSubmitted(true);
      setShowCompletionScreen(true);
      setIsSubmitting(false);
    } else {
      const nextIndex = myQuestionIndex + 1;
      setMyQuestionIndex(nextIndex);
      setSelectedOption(null);
      setSubmitted(false);
      setIsSubmitting(false);
      questionStartTimeRef.current = Date.now();
      const nextQ = questionsList[nextIndex];
      setTimerRemainingSec(nextQ?.timer_seconds || 30);
    }
  };

  // -------------------------------------------------------------
  // STATE: REMOVED SCREEN (Warning 3 strike)
  // -------------------------------------------------------------
  if (isRemoved) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-900">
        <div className="w-full max-w-md p-8 rounded-2xl bg-white border border-rose-200 text-center shadow-xl">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 flex items-center justify-center text-rose-600 mb-4 border border-rose-200">
            <Ban className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-rose-600 tracking-tight">REMOVED FROM SESSION</h2>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            You have received 3 confirmed anti-cheat warnings (tab switches, window focus loss, or leaving the quiz window).
          </p>
          <div className="my-6 p-4 rounded-xl bg-rose-50/60 border border-rose-100 text-left text-xs space-y-2">
            <p className="font-semibold text-rose-800">Session Rules Enforcement:</p>
            <ul className="list-disc pl-4 text-rose-700/80 space-y-1">
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
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-md"
          >
            Return to Join Screen
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-b from-[#F8FAFC] via-white to-[#F1F5F9] text-[#031246]">
      {/* Network Disconnect Warning Banner */}
      {!isConnected && (
        <div className="w-full bg-rose-600 text-white text-xs font-bold py-2 px-4 text-center flex items-center justify-center gap-2 shadow-md">
          <WifiOff className="w-4 h-4 animate-pulse" />
          <span>Connection Lost. Reconnecting to live session... (Normal network loss is not penalized)</span>
        </div>
      )}

      {/* Top Bar */}
      <header className="w-full max-w-2xl mx-auto flex items-center justify-between py-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-brand-purple/40 shadow-sm">
            <Image src="/logo.png" alt="Logo" fill className="object-contain" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-brand-purple">USICT GBU</h1>
            <p className="text-[10px] text-slate-500 font-medium">{participantName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-brand-purple hover:bg-slate-200 transition-all border border-slate-200"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Warning Badge */}
          {!showCompletionScreen && warningCount > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-300">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-white border border-amber-300 text-center shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-3 border border-amber-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-amber-700 uppercase tracking-tight">
              Anti-Cheat Warning {showWarningModal} of 3
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              You navigated away from the quiz window or switched tabs.
              {showWarningModal === 1 && ' This is your 1st warning. Please remain on this screen.'}
              {showWarningModal === 2 && ' CAUTION: A 3rd violation will cause IMMEDIATE REMOVAL.'}
            </p>
            <button
              onClick={() => {
                setShowWarningModal(null);
                lastViolationTimeRef.current = Date.now();
              }}
              className="mt-5 w-full py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-white transition-colors cursor-pointer active:scale-95"
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
        {(showCompletionScreen ||
          sessionState?.current_state === 'FINAL_RESULTS' ||
          sessionState?.current_state === 'COMPLETED') && (
          <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-xl text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-200">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="text-2xl font-black text-brand-navy">Answers Successfully Submitted!</h2>
            <p className="text-sm text-slate-600 mt-3 leading-relaxed">
              Thank you for participating with USICT GBU Programming Club. Your responses and response times have been safely recorded.
            </p>
            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              Winners and top performers will be announced directly by the Organizer.
            </div>
            <button
              onClick={handleExitQuiz}
              className="mt-6 px-6 py-2.5 rounded-xl bg-brand-purple hover:bg-[#6A1694] text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer inline-flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Exit Quiz</span>
            </button>
          </div>
        )}

        {/* -------------------------------------------------------- */}
        {/* 1. WAITING FOR ORGANIZER TO START (Only before Q1)       */}
        {/* -------------------------------------------------------- */}
        {!showCompletionScreen && sessionState?.current_state === 'WAITING' && (
          <div className="text-center p-8 rounded-2xl bg-white border border-slate-200 shadow-xl">
            <div className="w-12 h-12 border-2 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-brand-navy">Waiting for Quiz to Start...</h2>
            <p className="text-xs text-slate-500 mt-1">
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
                {/* Visual Progress Bar (Step Indicator) */}
                <div className="flex items-center gap-1.5 w-full px-1">
                  {Array.from({ length: totalQ }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                        i < myQuestionIndex
                          ? 'bg-emerald-500'
                          : i === myQuestionIndex
                          ? 'bg-brand-purple ring-2 ring-brand-purple/40 ring-offset-1 ring-offset-white'
                          : 'bg-slate-200'
                      }`}
                      title={`Question ${i + 1}`}
                    />
                  ))}
                </div>

                {/* Question Progress & Timer Bar */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-brand-purple tracking-wide">
                    Question {myQuestionIndex + 1} of {totalQ}
                  </div>

                  {/* Strict Countdown Timer Display */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold transition-all ${
                      timerRemainingSec <= 5
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-brand-purple/10 text-brand-purple'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{timerRemainingSec}s</span>
                  </div>
                </div>

                {/* Question Card */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-lg">
                  <h2 className="text-lg sm:text-xl font-bold leading-snug tracking-tight text-brand-navy">
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
                        type="button"
                        onClick={() => handleOptionSelect(idx)}
                        disabled={isSubmitting || submitted}
                        className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer select-none active:scale-[0.99] ${
                          isSelected
                            ? 'bg-brand-purple/10 text-brand-navy border-brand-purple ring-2 ring-brand-purple/50 shadow-md font-semibold'
                            : isSubmitting || submitted
                            ? 'opacity-60 bg-slate-100 border-slate-200'
                            : 'bg-white border-slate-200 hover:border-brand-purple/60 hover:bg-brand-purple/5 shadow-sm'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-brand-purple text-white shadow-sm'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {isSelected ? '✓' : optionLetters[idx]}
                        </span>
                        <span className="text-sm font-medium leading-relaxed mt-0.5 flex-1">{option}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Confirm & Submit Action Card (Like a proper quiz website) */}
                <div className="pt-2">
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-md space-y-3">
                    {selectedOption !== null ? (
                      <div className="flex items-center justify-between text-xs px-1">
                        <div className="flex items-center gap-1.5 text-brand-purple font-semibold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Option {['A', 'B', 'C', 'D'][selectedOption]} selected</span>
                        </div>
                        <span className="text-slate-500">Tap another option to change</span>
                      </div>
                    ) : (
                      <div className="text-xs text-center text-slate-500">
                        Select an option above to unlock submission
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleConfirmSubmit}
                      disabled={selectedOption === null || isSubmitting || submitted}
                      className={`w-full py-3.5 px-5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all shadow-md ${
                        selectedOption !== null && !isSubmitting && !submitted
                          ? 'bg-brand-purple hover:bg-[#6A1694] text-white cursor-pointer active:scale-[0.98] shadow-brand-purple/25'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      }`}
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Locking & Submitting Answer...</span>
                        </>
                      ) : selectedOption !== null ? (
                        <>
                          <span>Confirm & Submit Answer</span>
                          <span>→</span>
                        </>
                      ) : (
                        <span>Select an option to confirm</span>
                      )}
                    </button>

                    <p className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1">
                      <span>🔒 Once confirmed, your answer is locked and you cannot return.</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* Footer */}
      <footer className="w-full max-w-2xl mx-auto text-center py-2 text-[11px] text-slate-500">
        <p>USICT GBU Programming Club • LEARN • CONNECT • EXPLORE • GROW</p>
      </footer>
    </main>
  );
}
