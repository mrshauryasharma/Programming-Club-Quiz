'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  Trophy,
  Users,
  Target,
  Clock,
  AlertCircle,
  Award,
} from 'lucide-react';
import { useOrganizerAuth } from '@/lib/useOrganizerAuth';

export default function QuizHistoryAnalyticsPage() {
  const params = useParams();
  const code = (params.code as string)?.toUpperCase();
  const { isAuthenticated } = useOrganizerAuth();

  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch(`/api/sessions/${code}/analytics`)
      .then((res) => res.json())
      .then((data) => {
        if (data.analytics) setAnalytics(data.analytics);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [code, isAuthenticated]);

  if (isAuthenticated === null || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#F8FAFC] via-white to-[#F1F5F9]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Verifying organizer session...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return null;
  }

  if (!analytics) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#F8FAFC] via-white to-[#F1F5F9] text-[#031246]">
        <h2 className="text-xl font-bold">Analytics not found for session {code}</h2>
        <Link href="/organizer/dashboard" className="mt-4 text-xs font-bold text-brand-purple underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const { quiz, totalParticipants, maxScore, averageScore, leaderboard, questionSummaries, mostDifficultQuestion } =
    analytics;

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-gradient-to-b from-[#F8FAFC] via-white to-[#F1F5F9] text-[#031246]">
      {/* Top Header */}
      <header className="max-w-5xl mx-auto flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link
            href="/organizer/history"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-purple hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Event History</span>
          </Link>
          <span className="text-slate-300">•</span>
          <Link
            href="/organizer/dashboard"
            className="text-xs font-semibold text-slate-500 hover:text-brand-purple hover:underline"
          >
            Dashboard
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {/* Real Export Download Actions */}
          <a
            href={`/api/sessions/${code}/export/csv`}
            download
            className="px-3.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
          <a
            href={`/api/sessions/${code}/export/excel`}
            download
            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </a>
          <a
            href={`/api/sessions/${code}/export/pdf`}
            download
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </a>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto py-8 space-y-8">
        {/* Title & Stats Overview */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand-purple">
            Performance Analytics & Report
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-brand-navy mt-1">{quiz.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">
            GAME CODE: {code} • DATE: {new Date(analytics.session.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="text-slate-500 text-xs font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4 text-brand-purple" />
              <span>Participants</span>
            </div>
            <div className="text-2xl font-black mt-2 text-brand-navy">
              {totalParticipants}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="text-slate-500 text-xs font-semibold flex items-center gap-1.5">
              <Award className="w-4 h-4 text-brand-purple" />
              <span>Max Points</span>
            </div>
            <div className="text-2xl font-black mt-2 text-brand-purple">{maxScore} pts</div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="text-slate-500 text-xs font-semibold flex items-center gap-1.5">
              <Target className="w-4 h-4 text-brand-purple" />
              <span>Average Score</span>
            </div>
            <div className="text-2xl font-black mt-2 text-emerald-600">
              {averageScore} pts
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="text-slate-500 text-xs font-semibold flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Top Performer</span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-2 truncate">
              {leaderboard[0] ? leaderboard[0].name : 'N/A'}
            </div>
          </div>
        </div>

        {/* Most Difficult Question Highlight */}
        {mostDifficultQuestion && (
          <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-800 text-xs shadow-sm">
            <div className="flex items-center gap-2 font-bold mb-1">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Most Missed Question:</span>
            </div>
            <p className="text-sm font-semibold whitespace-pre-wrap leading-relaxed">{mostDifficultQuestion.question_text}</p>
            <div className="mt-2 flex items-center gap-4 text-slate-600 font-medium">
              <span>
                Accuracy:{' '}
                <strong className="text-amber-700 font-bold">
                  {mostDifficultQuestion.total_answers > 0
                    ? Math.round((mostDifficultQuestion.correct_count / mostDifficultQuestion.total_answers) * 100)
                    : 0}
                  %
                </strong>
              </span>
              <span>•</span>
              <span>
                Correct: {mostDifficultQuestion.correct_count} / {mostDifficultQuestion.total_answers}
              </span>
            </div>
          </div>
        )}

        {/* Question-Wise Performance Breakdown */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md">
          <h3 className="text-lg font-bold text-brand-navy mb-4">Question-wise Breakdown</h3>
          <div className="space-y-4">
            {questionSummaries.map((qs: any, idx: number) => {
              const accuracy =
                qs.total_answers > 0 ? Math.round((qs.correct_count / qs.total_answers) * 100) : 0;

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <span className="font-bold text-sm text-slate-900 whitespace-pre-wrap leading-relaxed flex-1">
                      Q{idx + 1}: {qs.question_text}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        accuracy >= 70
                          ? 'bg-emerald-100 text-emerald-700'
                          : accuracy >= 40
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {accuracy}% Accuracy
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-500 mt-2">
                    <div>
                      Correct Answers: <strong className="text-slate-800">{qs.correct_count}</strong>
                    </div>
                    <div>
                      Incorrect / Missed:{' '}
                      <strong className="text-slate-800">{qs.incorrect_count}</strong>
                    </div>
                    <div>
                      Avg Time:{' '}
                      <strong className="text-slate-800">
                        {qs.average_response_time_ms ? `${(qs.average_response_time_ms / 1000).toFixed(2)}s` : 'N/A'}
                      </strong>
                    </div>
                    <div>
                      Fastest:{' '}
                      <strong className="text-brand-purple">
                        {qs.fastest_answer_ms ? `${(qs.fastest_answer_ms / 1000).toFixed(2)}s` : 'N/A'}
                      </strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Final Leaderboard Table */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-md">
          <h3 className="text-lg font-bold text-brand-navy mb-4">Official Results & Leaderboard</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase font-semibold">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Roll No</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3 text-center">Score</th>
                  <th className="py-2.5 px-3 text-center">Total Time</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {leaderboard.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-bold">#{p.rank}</td>
                    <td className="py-3 px-3 font-bold text-slate-900">{p.name}</td>
                    <td className="py-3 px-3 font-mono">{p.roll_no}</td>
                    <td className="py-3 px-3 text-slate-500">{p.department}</td>
                    <td className="py-3 px-3 text-center font-bold text-brand-purple">
                      {p.total_score} / {maxScore} pts
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {(p.total_response_time_ms / 1000).toFixed(2)}s
                    </td>
                    <td className="py-3 px-3 text-center uppercase text-[10px] font-bold">
                      {p.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
