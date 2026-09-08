'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Sparkles,
  Save,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface QuestionForm {
  question_text: string;
  options: string[];
  correct_option_index: number;
  timer_seconds: number;
}

export default function CreateQuizPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionForm[]>([
    {
      question_text: '',
      options: ['', '', '', ''],
      correct_option_index: 0,
      timer_seconds: 30,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Meta AI modal state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        question_text: '',
        options: ['', '', '', ''],
        correct_option_index: 0,
        timer_seconds: 30,
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestionText = (index: number, text: string) => {
    const updated = [...questions];
    updated[index].question_text = text;
    setQuestions(updated);
  };

  const updateOptionText = (qIndex: number, optIndex: number, text: string) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = text;
    setQuestions(updated);
  };

  const updateCorrectOption = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    updated[qIndex].correct_option_index = optIndex;
    setQuestions(updated);
  };

  const updateTimer = (qIndex: number, seconds: number) => {
    const updated = [...questions];
    // Strict cap at 120 seconds
    const val = Math.min(120, Math.max(10, seconds));
    updated[qIndex].timer_seconds = val;
    setQuestions(updated);
  };

  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please provide a Quiz Title');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        setError(`Question ${i + 1} text cannot be empty`);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!q.options[j] || !q.options[j].trim()) {
          setError(`Question ${i + 1}, Option ${String.fromCharCode(65 + j)} cannot be empty`);
          return;
        }
      }
      if (q.timer_seconds < 10 || q.timer_seconds > 120) {
        setError(`Question ${i + 1} timer must be between 10 and 120 seconds`);
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          questions,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save quiz');

      router.push('/organizer/dashboard');
    } catch (err: any) {
      setError(err.message || 'Error saving quiz');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAiQuestions = async () => {
    if (!aiTopic.trim()) return;
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic, count: 5 }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Meta AI generation failed');
      }

      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setShowAiModal(false);
      }
    } catch (err: any) {
      setAiError(err.message || 'Meta AI error');
    } finally {
      setAiLoading(false);
    }
  };

  const timerPresets = [10, 15, 20, 30, 45, 60, 90, 120];

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-[#F7F4FE] dark:bg-[#020205] text-[#031246] dark:text-[#F7F4FE]">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto flex items-center justify-between pb-6 border-b border-slate-200 dark:border-brand-cardBorderDark">
        <Link
          href="/organizer/dashboard"
          className="inline-flex items-center gap-2 text-xs font-bold text-brand-purple hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Main Form */}
      <div className="max-w-4xl mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Create Technical Quiz</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Single-choice MCQ • Exactly 2 points per correct question • Max timer 120s
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAiModal(true)}
            className="px-3.5 py-2 rounded-xl bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple border border-brand-purple/30 font-bold text-xs flex items-center gap-2 hover:bg-brand-purple hover:text-white transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate with Meta AI</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSaveQuiz} className="space-y-6">
          {/* Quiz Details Card */}
          <div className="p-6 rounded-2xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-md space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                Quiz Title <span className="text-brand-purple">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Python & Data Structures Workshop Quiz"
                required
                className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 dark:text-slate-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Details about session or competition..."
                rows={2}
                className="w-full px-4 py-2 rounded-xl text-sm bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple outline-none"
              />
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-6">
            {questions.map((q, qIndex) => (
              <div
                key={qIndex}
                className="p-6 rounded-2xl bg-white/95 dark:bg-brand-cardDark/95 border border-slate-200 dark:border-brand-cardBorderDark shadow-md space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-brand-purple">
                    Question {qIndex + 1}
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div>
                  <input
                    type="text"
                    value={q.question_text}
                    onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                    placeholder="Enter question text..."
                    required
                    className="w-full px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple outline-none"
                  />
                </div>

                {/* 4 Options with Radio Selector */}
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">
                    Options & Correct Answer (Select circle for correct option)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {q.options.map((opt, optIndex) => {
                      const isCorrect = q.correct_option_index === optIndex;
                      const letters = ['A', 'B', 'C', 'D'];
                      return (
                        <div
                          key={optIndex}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                            isCorrect
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-slate-300 dark:border-brand-cardBorderDark bg-slate-50 dark:bg-[#080E2B]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => updateCorrectOption(qIndex, optIndex)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 transition-all ${
                              isCorrect
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600'
                            }`}
                          >
                            {letters[optIndex]}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOptionText(qIndex, optIndex, e.target.value)}
                            placeholder={`Option ${letters[optIndex]}...`}
                            required
                            className="w-full bg-transparent text-xs font-medium outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Timer Control */}
                <div className="pt-2 border-t border-slate-200 dark:border-brand-cardBorderDark flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-semibold">
                    <Clock className="w-4 h-4 text-brand-purple" />
                    <span>Timer:</span>
                    <span className="font-mono font-bold text-brand-purple">{q.timer_seconds}s</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {timerPresets.map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => updateTimer(qIndex, sec)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold ${
                          q.timer_seconds === sec
                            ? 'bg-brand-purple text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Question Button */}
          <button
            type="button"
            onClick={addQuestion}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-brand-purple/40 text-brand-purple hover:bg-brand-purple/5 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Question</span>
          </button>

          {/* Save Button */}
          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3.5 rounded-xl font-bold text-xs bg-brand-purple hover:bg-[#6A1694] text-white shadow-lg shadow-brand-purple/25 flex items-center gap-2 transition-all cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>SAVE QUIZ TO LIBRARY</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Meta AI Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-brand-cardDark border border-brand-purple text-left shadow-2xl">
            <div className="flex items-center gap-2 text-brand-purple mb-3">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-base font-bold">Generate with Meta AI</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-brand-slate mb-4">
              Enter a programming topic to automatically generate 5 technical MCQs using Meta AI.
            </p>

            {aiError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
                {aiError}
              </div>
            )}

            <input
              type="text"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
              placeholder="e.g. JavaScript Async/Await & Promises"
              className="w-full px-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-[#080E2B] border border-slate-300 dark:border-brand-cardBorderDark focus:border-brand-purple outline-none mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateAiQuestions}
                disabled={aiLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-purple text-white hover:bg-[#6A1694] flex items-center gap-2 cursor-pointer"
              >
                {aiLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Generate Questions</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
