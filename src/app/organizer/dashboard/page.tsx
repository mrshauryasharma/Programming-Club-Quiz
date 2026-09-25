'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Plus,
  Play,
  History,
  FileText,
  LogOut,
  Sparkles,
  BarChart3,
  Trash2,
  ExternalLink,
  Pencil,
  Edit3,
} from 'lucide-react';

import { useOrganizerAuth } from '@/lib/useOrganizerAuth';

export default function OrganizerDashboardPage() {
  const router = useRouter();
  const { isAuthenticated } = useOrganizerAuth();
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingSessionId, setStartingSessionId] = useState<string | null>(null);

  const fetchQuizzes = async () => {
    try {
      const res = await fetch('/api/quizzes');
      if (!res.ok) throw new Error('Failed to load quizzes');
      const data = await res.json();
      setQuizzes(data.quizzes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchQuizzes();
    }
  }, [isAuthenticated]);

  const handleStartLiveQuiz = async (quizId: string) => {
    setStartingSessionId(quizId);
    try {
      const res = await fetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quiz_id: quizId }),
      });
      const data = await res.json();
      if (res.ok && data.session) {
        router.push(`/organizer/session/${data.session.game_code}`);
      } else {
        alert(data.error || 'Failed to start session');
      }
    } catch (err: any) {
      alert(err.message || 'Error starting live quiz');
    } finally {
      setStartingSessionId(null);
    }
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;
    try {
      await fetch(`/api/quizzes/${quizId}`, { method: 'DELETE' });
      fetchQuizzes();
    } catch (e) {
      alert('Failed to delete');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/organizer/auth', { method: 'DELETE' });
    router.push('/organizer/login');
  };

  if (isAuthenticated === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F8FAFC] via-white to-[#F1F5F9]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-purple/20 border-t-brand-purple rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Verifying organizer session...</p>
        </div>
      </main>
    );
  }

  if (isAuthenticated === false) {
    return null;
  }

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-[#F8FAFC] via-white to-[#F1F5F9] text-[#031246]">
      {/* Organizer Header */}
      <header className="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-full overflow-hidden border-2 border-brand-purple shadow-sm">
            <Image src="/logo.png" alt="Logo" fill className="object-contain" priority />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-brand-purple uppercase">
                USICT GBU PROGRAMMING CLUB
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-purple/10 text-brand-purple">
                ORGANIZER
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Quiz & Live Session Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/organizer/history"
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-brand-purple hover:text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
          >
            <History className="w-4 h-4" />
            <span>History</span>
          </Link>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto py-8 space-y-8">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-brand-navy">Quiz Library</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Create, preview, and host real-time technical quizzes for club workshops and competitions.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/organizer/history"
              className="px-4 py-2.5 rounded-xl border border-brand-purple/30 bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <History className="w-4 h-4" />
              <span>Event History</span>
            </Link>

            <Link
              href="/organizer/quizzes/new"
              className="px-4 py-2.5 rounded-xl bg-brand-purple hover:bg-[#6A1694] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-brand-purple/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Quiz</span>
            </Link>
          </div>
        </div>

        {/* Quiz Cards Grid */}
        {loading ? (
          <div className="text-center py-16">
            <div className="w-10 h-10 border-3 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading quizzes...</p>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-3xl bg-white border border-slate-200 shadow-sm">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-brand-navy">No quizzes available</h3>
            <p className="text-xs text-slate-500 mt-1">Get started by creating your first quiz.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="flex flex-col justify-between p-6 rounded-2xl bg-white border border-slate-200 shadow-md hover:shadow-lg transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-base font-bold text-brand-navy leading-snug">
                      {quiz.title}
                    </h3>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/organizer/quizzes/${quiz.id}/edit`}
                        className="text-slate-400 hover:text-brand-purple p-1.5 rounded-lg hover:bg-brand-purple/10 transition-colors"
                        title="Edit quiz"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDeleteQuiz(quiz.id)}
                        className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete quiz"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                    {quiz.description || 'USICT GBU Programming Club Technical Quiz'}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-6">
                    <span className="font-semibold text-brand-purple">
                      {quiz.question_count ?? quiz.questions?.length ?? 0} Questions
                    </span>
                    <span>•</span>
                    <span>Created {new Date(quiz.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Host Live & Edit Buttons */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/organizer/quizzes/${quiz.id}/edit`}
                    className="py-3 px-3.5 rounded-xl font-bold text-xs border border-slate-200 hover:border-brand-purple/50 bg-slate-50 hover:bg-brand-purple/10 text-slate-700 hover:text-brand-purple flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    title="Edit Questions & Settings"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>EDIT</span>
                  </Link>

                  <button
                    onClick={() => handleStartLiveQuiz(quiz.id)}
                    disabled={startingSessionId === quiz.id}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-brand-purple to-brand-indigo hover:from-[#6A1694] hover:to-[#2F2766] text-white flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
                  >
                    {startingSessionId === quiz.id ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        <span>START LIVE QUIZ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
