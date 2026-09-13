'use client';

import React, { useEffect, useState, use } from 'react';
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
  FileUp,
  Upload,
  FileText,
  X,
  Edit3,
} from 'lucide-react';
import { parseMCQsFromText, extractTextFromPdfArrayBuffer } from '@/lib/pdfParser';

interface QuestionForm {
  question_text: string;
  options: string[];
  correct_option_index: number;
  timer_seconds: number;
}

export default function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const quizId = resolvedParams.id;
  const router = useRouter();

  const [initialLoading, setInitialLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<QuestionForm[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Meta AI modal state
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // PDF Scanner modal state
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Load existing quiz data
  useEffect(() => {
    async function loadQuiz() {
      try {
        setInitialLoading(true);
        const res = await fetch(`/api/quizzes/${quizId}`);
        if (!res.ok) throw new Error('Quiz not found');
        const data = await res.json();
        if (data.quiz) {
          setTitle(data.quiz.title || '');
          setDescription(data.quiz.description || '');
          if (data.quiz.questions && data.quiz.questions.length > 0) {
            setQuestions(
              data.quiz.questions.map((q: any) => ({
                question_text: q.question_text || '',
                options: q.options && q.options.length >= 4 ? q.options.slice(0, 4) : [...(q.options || []), '', '', '', ''].slice(0, 4),
                correct_option_index: q.correct_option_index ?? 0,
                timer_seconds: q.timer_seconds ?? 30,
              }))
            );
          } else {
            setQuestions([
              {
                question_text: '',
                options: ['', '', '', ''],
                correct_option_index: 0,
                timer_seconds: 30,
              },
            ]);
          }
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load quiz');
      } finally {
        setInitialLoading(false);
      }
    }
    loadQuiz();
  }, [quizId]);

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
    const val = Math.min(120, Math.max(10, seconds));
    updated[qIndex].timer_seconds = val;
    setQuestions(updated);
  };

  const handleUpdateQuiz = async (e: React.FormEvent) => {
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
      const res = await fetch(`/api/quizzes/${quizId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          questions,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update quiz');

      setSaveSuccess(true);
      setTimeout(() => {
        router.push('/organizer/dashboard');
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Error updating quiz');
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
        setQuestions([...questions, ...data.questions]);
        setShowAiModal(false);
      }
    } catch (err: any) {
      setAiError(err.message || 'Meta AI error');
    } finally {
      setAiLoading(false);
    }
  };

  const handleScanPdf = async () => {
    if (!pdfFile) return;
    setPdfLoading(true);
    setPdfError(null);

    try {
      // 1. Direct browser-side array buffer extraction
      try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const extractedText = await extractTextFromPdfArrayBuffer(arrayBuffer);
        const localQuestions = parseMCQsFromText(extractedText);

        if (localQuestions && localQuestions.length > 0) {
          setQuestions(localQuestions);
          setShowPdfModal(false);
          setPdfFile(null);
          return;
        }
      } catch (clientErr) {
        console.warn('Client-side PDF extraction encountered error, attempting server fallback:', clientErr);
      }

      // 2. Server-side fallback: send full file via multipart FormData
      const formData = new FormData();
      formData.append('file', pdfFile);

      const res = await fetch('/api/ai/scan-pdf', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          setShowPdfModal(false);
          setPdfFile(null);
          return;
        }
      }

      const errData = await res.json().catch(() => null);
      throw new Error(
        errData?.error || 'Could not detect questions in this PDF. Please check that the PDF contains readable text.'
      );
    } catch (err: any) {
      setPdfError(err.message || 'Error processing PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const timerPresets = [10, 15, 20, 30, 45, 60, 90, 120];

  if (initialLoading) {
    return (
      <main className="min-h-screen p-8 bg-[#F7F4FE] dark:bg-[#020205] text-[#031246] dark:text-[#F7F4FE] flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-3 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-500">Loading quiz questions...</p>
      </main>
    );
  }

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

      <div className="max-w-4xl mx-auto py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-brand-purple/10 text-brand-purple">
                EDIT MODE
              </span>
              <span className="text-xs text-slate-400 font-bold">• {questions.length} Questions</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">Edit Quiz</h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Modify quiz details, questions, answer options, and per-question timers.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Meta AI Generator Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowAiModal(true)}
              className="px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-300 font-bold text-xs flex items-center gap-1.5 transition-all border border-purple-500/20 cursor-pointer shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Append</span>
            </button>

            {/* Scan PDF Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowPdfModal(true)}
              className="px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 font-bold text-xs flex items-center gap-1.5 transition-all border border-indigo-500/20 cursor-pointer shadow-sm"
            >
              <FileUp className="w-4 h-4" />
              <span>Import PDF</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="p-4 mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Quiz updated successfully! Redirecting to dashboard...</span>
          </div>
        )}

        <form onSubmit={handleUpdateQuiz} className="space-y-8">
          {/* Quiz Details Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-brand-cardDark border border-slate-200 dark:border-brand-cardBorderDark shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Quiz Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Web Development Workshop — Quiz 1"
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-brand-cardDarkBorder border border-slate-200 dark:border-brand-cardBorderDark text-sm font-semibold focus:outline-none focus:border-brand-purple"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of the topics or workshop session..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-brand-cardDarkBorder border border-slate-200 dark:border-brand-cardBorderDark text-sm font-medium focus:outline-none focus:border-brand-purple"
              />
            </div>
          </div>

          {/* Questions Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black tracking-tight">Questions ({questions.length})</h2>
              <span className="text-[11px] font-bold text-slate-400">
                Rule: Single-choice MCQ • Correct = +2 pts • Incorrect = 0 pts
              </span>
            </div>

            {questions.map((q, qIndex) => (
              <div
                key={qIndex}
                className="p-6 rounded-3xl bg-white dark:bg-brand-cardDark border border-slate-200 dark:border-brand-cardBorderDark shadow-sm space-y-5 relative"
              >
                {/* Question Header & Controls */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-brand-purple/10 text-brand-purple font-black text-xs flex items-center justify-center">
                      {qIndex + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-500">Question {qIndex + 1}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Timer Selector */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <select
                        value={q.timer_seconds}
                        onChange={(e) => updateTimer(qIndex, Number(e.target.value))}
                        className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer text-[#031246] dark:text-[#F7F4FE]"
                      >
                        {timerPresets.map((t) => (
                          <option key={t} value={t} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                            {t}s timer
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Delete Question */}
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIndex)}
                      disabled={questions.length === 1}
                      title={questions.length === 1 ? 'Quiz must have at least 1 question' : 'Delete question'}
                      className="p-1.5 text-slate-400 hover:text-rose-500 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text Input */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Question Text
                  </label>
                  <textarea
                    value={q.question_text}
                    onChange={(e) => updateQuestionText(qIndex, e.target.value)}
                    placeholder="Enter the question text here..."
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-brand-cardDarkBorder border border-slate-200 dark:border-brand-cardBorderDark text-sm font-semibold focus:outline-none focus:border-brand-purple"
                    required
                  />
                </div>

                {/* 4 Options */}
                <div className="space-y-2.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Answer Options (Click radio button to mark correct answer)
                  </label>

                  <div className="grid grid-cols-1 gap-2.5">
                    {q.options.map((opt, optIndex) => {
                      const isCorrect = q.correct_option_index === optIndex;
                      const letter = String.fromCharCode(65 + optIndex);
                      return (
                        <div
                          key={optIndex}
                          onClick={() => updateCorrectOption(qIndex, optIndex)}
                          className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all cursor-pointer ${
                            isCorrect
                              ? 'bg-purple-500/10 border-brand-purple dark:bg-purple-900/20'
                              : 'bg-slate-50 dark:bg-brand-cardDarkBorder border-slate-200 dark:border-brand-cardBorderDark hover:border-slate-300'
                          }`}
                        >
                          <button
                            type="button"
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-colors ${
                              isCorrect
                                ? 'bg-brand-purple text-white'
                                : 'border-2 border-slate-300 dark:border-slate-600 text-slate-500'
                            }`}
                          >
                            {letter}
                          </button>

                          <input
                            type="text"
                            value={opt}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateOptionText(qIndex, optIndex, e.target.value)}
                            placeholder={`Option ${letter} text...`}
                            className="w-full bg-transparent text-xs sm:text-sm font-medium focus:outline-none"
                            required
                          />

                          {isCorrect && (
                            <span className="text-[10px] font-black uppercase tracking-wider text-brand-purple shrink-0 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Correct</span>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            {/* Add Question Button */}
            <button
              type="button"
              onClick={addQuestion}
              className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand-purple rounded-3xl text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-brand-purple flex items-center justify-center gap-2 transition-all cursor-pointer bg-white/50 dark:bg-transparent"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Question</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200 dark:border-slate-800">
            <Link
              href="/organizer/dashboard"
              className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 rounded-xl bg-brand-purple hover:bg-[#6A1694] text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-brand-purple/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Meta AI Generator Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-brand-cardDark border border-slate-200 dark:border-brand-cardBorderDark shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-purple" />
                <h3 className="text-base font-bold">Generate with Meta AI</h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Enter any CS / Web / Programming topic to generate 5 high-quality MCQs.
            </p>

            {aiError && (
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-semibold">
                {aiError}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Topic</label>
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                placeholder="e.g. React hooks, SQL joins, Data Structures"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-brand-cardDarkBorder border border-slate-200 dark:border-brand-cardBorderDark text-xs font-semibold focus:outline-none focus:border-brand-purple"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGenerateAiQuestions}
                disabled={aiLoading || !aiTopic.trim()}
                className="px-5 py-2 rounded-xl bg-brand-purple hover:bg-[#6A1694] text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-brand-purple/20"
              >
                {aiLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate & Append</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Scanner Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-brand-cardDark border border-slate-200 dark:border-brand-cardBorderDark shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileUp className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-bold">Import from PDF</h3>
              </div>
              <button
                onClick={() => {
                  setShowPdfModal(false);
                  setPdfFile(null);
                  setPdfError(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Upload an MCQ document in PDF format. Questions will replace current list.
            </p>

            {pdfError && (
              <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-semibold">
                {pdfError}
              </div>
            )}

            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-indigo-500 transition-colors">
              <input
                type="file"
                id="edit-pdf-upload"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setPdfFile(e.target.files[0]);
                    setPdfError(null);
                  }
                }}
              />
              <label htmlFor="edit-pdf-upload" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="w-8 h-8 text-indigo-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {pdfFile ? pdfFile.name : 'Click to select PDF document'}
                </span>
                <span className="text-[10px] text-slate-400">PDF up to 10MB</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPdfModal(false);
                  setPdfFile(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScanPdf}
                disabled={pdfLoading || !pdfFile}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-indigo-600/20"
              >
                {pdfLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    <span>Scan & Load MCQs</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
