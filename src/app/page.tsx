'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { OFFICIAL_DEPARTMENTS } from '@/config/departments';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  GraduationCap,
  Building2,
  User,
  KeyRound,
} from 'lucide-react';

const YEAR_OPTIONS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
];

function JoinQuizFlowContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Current active step: 1 = Code, 2 = Year, 3 = Department, 4 = Student Information
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State
  const [gameCode, setGameCode] = useState('');
  const [validatedSession, setValidatedSession] = useState<{
    game_code: string;
    quiz_title: string;
  } | null>(null);

  const [year, setYear] = useState('');
  const [department, setDepartment] = useState('');
  const [customDepartment, setCustomDepartment] = useState('');

  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [email, setEmail] = useState('');

  // UI state
  const [validatingCode, setValidatingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh join session initialization: clear any previous participant or removal state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pc_quiz_participant_id');
      sessionStorage.removeItem('pc_quiz_participant_name');
      sessionStorage.removeItem('pc_quiz_session_code');
      // Clear any cached answer keys
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('pc_ans_')) {
          sessionStorage.removeItem(k);
        }
      });
    }
    setError(null);
  }, []);

  // If URL contains ?code=... from QR scan, prefill and auto-validate
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      const formatted = codeParam.trim().toUpperCase();
      setGameCode(formatted);
      validateCode(formatted);
    }
  }, [searchParams]);

  // STEP 1 VALIDATION: Verify QR / Game Code
  const validateCode = async (codeToVerify?: string) => {
    const targetCode = (codeToVerify || gameCode).trim().toUpperCase();
    setError(null);

    if (!targetCode || targetCode.length < 4) {
      setError('Please enter a valid Game Code');
      return;
    }

    // Clear stale session credentials when validating a code
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pc_quiz_participant_id');
      sessionStorage.removeItem('pc_quiz_participant_name');
      sessionStorage.removeItem('pc_quiz_session_code');
    }

    setValidatingCode(true);

    try {
      const res = await fetch(`/api/sessions/${targetCode}/validate`);
      const data = await res.json();

      if (!res.ok || !data.valid) {
        throw new Error(data.error || 'Invalid or expired Game Code');
      }

      setValidatedSession({
        game_code: data.game_code,
        quiz_title: data.quiz_title,
      });

      // Advance to STEP 2 (Year) ONLY upon successful validation
      setError(null);
      setCurrentStep(2);
    } catch (err: any) {
      setError(err.message || 'Invalid Game Code. Please check and try again.');
      setValidatedSession(null);
    } finally {
      setValidatingCode(false);
    }
  };

  // STEP 2: Year Selected -> Advance to Step 3
  const handleSelectYear = (selectedYear: string) => {
    setYear(selectedYear);
    setError(null);
    setCurrentStep(3);
  };

  // STEP 3: Department Submit -> Advance to Step 4
  const handleDepartmentContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!department) {
      setError('Please select your Department');
      return;
    }

    if (department === 'Other' && !customDepartment.trim()) {
      setError('Please enter your department name');
      return;
    }

    setCurrentStep(4);
  };

  // STEP 4: Submit Final Registration
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanRoll = rollNo.trim().toUpperCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError('Please enter your Full Name');
      return;
    }
    if (!cleanRoll) {
      setError('Please enter your official Roll Number');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid Email ID');
      return;
    }

    setSubmitting(true);

    const effectiveDept = department === 'Other' ? customDepartment.trim() : department;

    try {
      const res = await fetch(`/api/sessions/${gameCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          roll_no: cleanRoll,
          year,
          department: effectiveDept,
          custom_department: department === 'Other' ? customDepartment.trim() : '',
          email: cleanEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join session');
      }

      // Store participant identity in sessionStorage for reconnection
      sessionStorage.setItem('pc_quiz_participant_id', data.participant.id);
      sessionStorage.setItem('pc_quiz_participant_name', data.participant.name);
      sessionStorage.setItem('pc_quiz_session_code', gameCode);

      // Redirect to waiting room
      router.push(`/session/${gameCode}/waiting`);
    } catch (err: any) {
      setError(err.message || 'Error joining quiz session');
    } finally {
      setSubmitting(false);
    }
  };

  // Department options list: official 27 + Other
  const departmentOptions = [...OFFICIAL_DEPARTMENTS, 'Other'];

  return (
    <main className="min-h-screen flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-gradient-to-b from-[#F7F4FE] via-white to-[#EDE8FD] dark:from-[#020205] dark:via-[#030926] dark:to-[#020205] text-[#031246] dark:text-[#F7F4FE]">
      {/* Top Header Bar */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-full overflow-hidden border border-brand-purple/30 shadow-sm">
            <Image
              src="/logo.png"
              alt="Programming Club Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-xs font-bold uppercase tracking-wider text-brand-purple">
              USICT GBU
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Programming Club
            </p>
          </div>
        </div>

        <ThemeToggle />
      </header>

      {/* Main Registration Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-md">
          {/* Header Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple mb-2">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Programming Club Quiz
            </h2>
            <p className="text-xs text-slate-500 dark:text-brand-slate mt-1 font-medium tracking-wide">
              LEARN • CONNECT • EXPLORE • GROW
            </p>
          </div>

          {/* Stepper Progress Indicator */}
          <div className="flex items-center justify-between mb-6 px-2">
            {[
              { num: 1, label: 'Code' },
              { num: 2, label: 'Year' },
              { num: 3, label: 'Dept' },
              { num: 4, label: 'Details' },
            ].map((st, idx) => (
              <React.Fragment key={st.num}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      currentStep === st.num
                        ? 'bg-brand-purple text-white ring-4 ring-brand-purple/20'
                        : currentStep > st.num
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {currentStep > st.num ? '✓' : st.num}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1">
                    {st.label}
                  </span>
                </div>
                {idx < 3 && (
                  <div
                    className={`flex-1 h-0.5 mx-1.5 transition-colors ${
                      currentStep > idx + 1 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 1 — QR SCAN / ENTER CODE                                */}
          {/* ============================================================ */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="gameCode"
                    className="text-xs font-bold tracking-wide uppercase text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-brand-purple" />
                    <span>Game Code</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Scan QR or enter 6 letters</span>
                </div>
                <input
                  id="gameCode"
                  type="text"
                  maxLength={8}
                  value={gameCode}
                  onChange={(e) => {
                    setGameCode(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="e.g. ABC123"
                  className="w-full px-4 py-3.5 rounded-xl font-mono text-center tracking-widest text-xl font-black uppercase bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
              </div>

              <button
                type="button"
                onClick={() => validateCode()}
                disabled={validatingCode || !gameCode.trim()}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-brand-purple to-brand-indigo hover:from-[#6A1694] hover:to-[#2F2766] text-white shadow-lg shadow-brand-purple/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {validatingCode ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>VERIFY CODE & CONTINUE</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 2 — YEAR (Must come BEFORE Department)                 */}
          {/* ============================================================ */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-brand-cardBorderDark/40">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setCurrentStep(1);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-brand-purple flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Code</span>
                </button>
                {validatedSession && (
                  <span className="text-[11px] font-mono font-bold text-brand-purple">
                    {validatedSession.game_code}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-brand-navy dark:text-white mb-2 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-brand-purple" />
                  <span>Select your Year</span>
                  <span className="text-brand-purple">*</span>
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Please select your current academic year to proceed.
                </p>

                <div className="grid grid-cols-1 gap-2.5">
                  {YEAR_OPTIONS.map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => handleSelectYear(yr)}
                      className={`p-3.5 rounded-xl border text-left font-bold text-xs flex items-center justify-between transition-all cursor-pointer select-none active:scale-[0.98] ${
                        year === yr
                          ? 'bg-brand-purple text-white border-brand-purple shadow-md'
                          : 'bg-slate-50 dark:bg-[#080E2B] border-slate-200 dark:border-brand-cardBorderDark hover:border-brand-purple/60 hover:bg-brand-purple/5'
                      }`}
                    >
                      <span>{yr}</span>
                      <ArrowRight className="w-4 h-4 opacity-70" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* STEP 3 — DEPARTMENT                                          */}
          {/* ============================================================ */}
          {currentStep === 3 && (
            <form onSubmit={handleDepartmentContinue} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-brand-cardBorderDark/40">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setCurrentStep(2);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-brand-purple flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Year ({year})</span>
                </button>
                <span className="text-[11px] font-semibold text-brand-purple">{year}</span>
              </div>

              <div>
                <label
                  htmlFor="departmentSelect"
                  className="block text-sm font-bold text-brand-navy dark:text-white mb-1.5 flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4 text-brand-purple" />
                  <span>Department</span>
                  <span className="text-brand-purple">*</span>
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                  Choose your department from the list or select Other.
                </p>

                <select
                  id="departmentSelect"
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setError(null);
                  }}
                  required
                  className="w-full px-3.5 py-3 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all text-slate-800 dark:text-slate-200 font-medium"
                >
                  <option value="">Select Department</option>
                  {departmentOptions.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>

                {OFFICIAL_DEPARTMENTS.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">
                    Official 27 departments pending insertion in src/config/departments.ts. Please select "Other" to specify your department.
                  </p>
                )}
              </div>

              {/* Required when 'Other' is selected */}
              {department === 'Other' && (
                <div className="pt-2 animate-in fade-in-50">
                  <label
                    htmlFor="customDepartment"
                    className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Enter your department <span className="text-brand-purple">*</span>
                  </label>
                  <input
                    id="customDepartment"
                    type="text"
                    value={customDepartment}
                    onChange={(e) => {
                      setCustomDepartment(e.target.value);
                      setError(null);
                    }}
                    placeholder="Type your official department name..."
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all font-medium"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={!department || (department === 'Other' && !customDepartment.trim())}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-brand-purple hover:bg-[#6A1694] text-white flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <span>CONTINUE TO DETAILS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ============================================================ */}
          {/* STEP 4 — STUDENT INFORMATION                                 */}
          {/* ============================================================ */}
          {currentStep === 4 && (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-brand-cardBorderDark/40">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setCurrentStep(3);
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-brand-purple flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Change Dept</span>
                </button>
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <span>{year}</span> •{' '}
                  <span className="truncate max-w-[120px] inline-block align-bottom font-bold text-brand-purple">
                    {department === 'Other' ? customDepartment : department}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-brand-navy dark:text-white mb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-brand-purple" />
                  <span>Student Information</span>
                </label>
              </div>

              {/* Full Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
                >
                  Full Name <span className="text-brand-purple">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. Rahul Kumar"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all"
                />
              </div>

              {/* Roll Number */}
              <div>
                <label
                  htmlFor="rollNo"
                  className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
                >
                  Roll Number <span className="text-brand-purple">*</span>
                </label>
                <input
                  id="rollNo"
                  type="text"
                  value={rollNo}
                  onChange={(e) => {
                    setRollNo(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="e.g. 23CS1042"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono uppercase bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all"
                />
              </div>

              {/* Email ID */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
                >
                  Email ID <span className="text-brand-purple">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="e.g. rahul@example.com"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-3.5 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-brand-purple to-brand-indigo hover:from-[#6A1694] hover:to-[#2F2766] text-white shadow-lg shadow-brand-purple/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>SUBMIT & JOIN QUIZ</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto text-center py-2 text-[11px] text-slate-500 dark:text-slate-400">
        <p>SOICT • Gautam Buddha University</p>
      </footer>
    </main>
  );
}

export default function JoinQuizPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F7F4FE] dark:bg-[#020205]">
          <div className="w-8 h-8 border-3 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
        </div>
      }
    >
      <JoinQuizFlowContent />
    </Suspense>
  );
}
