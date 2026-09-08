'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { OFFICIAL_DEPARTMENTS, isDepartmentsConfigured } from '@/config/departments';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ArrowRight, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

function JoinQuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [gameCode, setGameCode] = useState('');
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill Game Code if coming from QR code URL (?code=ABC123)
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setGameCode(codeParam.toUpperCase());
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = gameCode.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanRoll = rollNo.trim().toUpperCase();
    const cleanDept = department.trim();
    const cleanEmail = email.trim();

    if (!cleanCode || cleanCode.length < 4) {
      setError('Please enter a valid 6-character Game Code');
      return;
    }
    if (!cleanName) {
      setError('Please enter your full Name');
      return;
    }
    if (!cleanRoll) {
      setError('Please enter your official Roll Number');
      return;
    }
    if (!cleanDept) {
      setError('Please select or specify your Department');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid Email ID');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/sessions/${cleanCode}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          roll_no: cleanRoll,
          department: cleanDept,
          email: cleanEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to join quiz session');
      }

      // Store participant credentials securely in sessionStorage for reconnects
      sessionStorage.setItem('pc_quiz_participant_id', data.participant.id);
      sessionStorage.setItem('pc_quiz_participant_name', data.participant.name);
      sessionStorage.setItem('pc_quiz_session_code', cleanCode);

      // Route to waiting room / active quiz
      router.push(`/session/${cleanCode}/waiting`);
    } catch (err: any) {
      setError(err.message || 'Error joining quiz. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasDepartments = isDepartmentsConfigured();

  return (
    <main className="min-h-screen flex flex-col justify-between p-4 sm:p-6 md:p-8 bg-gradient-to-b from-[#F7F4FE] via-white to-[#EDE8FD] dark:from-[#020205] dark:via-[#030926] dark:to-[#020205] text-[#031246] dark:text-[#F7F4FE]">
      {/* Top Bar with Branding & Theme Switcher */}
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

      {/* Main Join Container */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white/90 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark rounded-2xl p-6 sm:p-8 shadow-xl backdrop-blur-md">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Programming Club Quiz
            </h2>
            <p className="text-xs text-slate-500 dark:text-brand-slate mt-1.5 font-medium tracking-wide">
              LEARN • CONNECT • EXPLORE • GROW
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Game Code Field */}
            <div>
              <label
                htmlFor="gameCode"
                className="block text-xs font-bold tracking-wide uppercase text-slate-600 dark:text-slate-300 mb-1.5"
              >
                Game Code <span className="text-brand-purple">*</span>
              </label>
              <input
                id="gameCode"
                type="text"
                maxLength={8}
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                required
                className="w-full px-4 py-3 rounded-xl font-mono text-center tracking-widest text-lg font-bold uppercase bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
            </div>

            {/* Name Field */}
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
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rahul Kumar"
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all"
              />
            </div>

            {/* Roll Number Field */}
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
                onChange={(e) => setRollNo(e.target.value.toUpperCase())}
                placeholder="e.g. 23CS1042"
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono uppercase bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all"
              />
            </div>

            {/* Department Field */}
            <div>
              <label
                htmlFor="department"
                className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1"
              >
                Department <span className="text-brand-purple">*</span>
              </label>

              {hasDepartments ? (
                <select
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all text-slate-800 dark:text-slate-200"
                >
                  <option value="">Select Department</option>
                  {OFFICIAL_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              ) : (
                <div>
                  <input
                    id="department"
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Enter your official department"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all"
                  />
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    Note: Official 27 department names pending configuration in src/config/departments.ts.
                  </p>
                </div>
              )}
            </div>

            {/* Email Field */}
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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. rahul@example.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-brand-purple to-brand-indigo hover:from-[#6A1694] hover:to-[#2F2766] text-white shadow-lg shadow-brand-purple/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>JOIN QUIZ</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
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
      <JoinQuizContent />
    </Suspense>
  );
}
