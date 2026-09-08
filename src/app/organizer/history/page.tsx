'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SessionHistoryItem } from '@/types/quiz';
import {
  ArrowLeft,
  Search,
  History,
  Users,
  Award,
  Calendar,
  Clock,
  FileSpreadsheet,
  FileText,
  ExternalLink,
  Play,
  CheckCircle2,
  AlertCircle,
  Radio,
  ChevronRight,
  Filter,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export default function OrganizerHistoryPage() {
  const [history, setHistory] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'ACTIVE' | 'WAITING'>('ALL');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/organizer/history');
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Failed to fetch event history:', err);
    } finally {
      setLoading(false);
    }
  };

  const [eventToDelete, setEventToDelete] = useState<SessionHistoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/organizer/history/${eventToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete event');
      }

      // Remove from history list immediately
      setHistory((prev) => prev.filter((h) => h.id !== eventToDelete.id));
      setEventToDelete(null);
    } catch (err: any) {
      setDeleteError(err.message || 'An error occurred while deleting the event');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter((item) => {
      const matchesSearch =
        item.quiz_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.game_code.toLowerCase().includes(searchQuery.toLowerCase());

      const normalizedStatus = (item.status || 'WAITING').toUpperCase();
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'COMPLETED' && (normalizedStatus === 'COMPLETED' || normalizedStatus === 'ENDED' || item.current_state === 'FINAL_RESULTS' || item.current_state === 'COMPLETED')) ||
        (statusFilter === 'ACTIVE' && (normalizedStatus === 'ACTIVE' || (item.current_state !== 'WAITING' && item.current_state !== 'COMPLETED' && item.current_state !== 'FINAL_RESULTS'))) ||
        (statusFilter === 'WAITING' && (normalizedStatus === 'WAITING' && item.current_state === 'WAITING'));

      return matchesSearch && matchesStatus;
    });
  }, [history, searchQuery, statusFilter]);

  const totalParticipantsConducted = useMemo(() => {
    return history.reduce((acc, h) => acc + (h.total_participants || 0), 0);
  }, [history]);

  return (
    <main className="min-h-screen p-4 sm:p-8 bg-[#F7F4FE] dark:bg-[#020205] text-[#031246] dark:text-[#F7F4FE]">
      {/* Organizer Header */}
      <header className="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-slate-200 dark:border-brand-cardBorderDark">
        <div className="flex items-center gap-3">
          <Link
            href="/organizer/dashboard"
            className="p-2 rounded-xl bg-slate-200 dark:bg-brand-cardDark text-slate-700 dark:text-slate-300 hover:text-brand-purple dark:hover:text-purple-400 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-brand-purple shadow-sm">
            <Image src="/logo.png" alt="Programming Club Logo" fill className="object-contain" priority />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-brand-purple uppercase">
                USICT GBU PROGRAMMING CLUB
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-brand-purple/10 text-brand-purple dark:text-purple-300">
                ORGANIZER
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Quiz Event History & Analytics Archive
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/organizer/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-brand-purple dark:hover:text-purple-300 transition-colors"
          >
            <span>Dashboard</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto py-8 space-y-8">
        {/* Page Title & Summary Metrics */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-brand-purple">
              <History className="w-5 h-5" />
              <span className="text-xs font-extrabold uppercase tracking-wider">Historical Archive</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">Quiz Events Conducted</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Each live session is stored as an independent quiz event with its own code, participants, and verified results.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-2xl bg-white dark:bg-brand-cardDark border border-slate-200 dark:border-brand-cardBorderDark shadow-sm flex items-center gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Events</p>
                <p className="text-lg font-black text-brand-purple">{history.length}</p>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Participants</p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{totalParticipantsConducted}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-brand-cardDark border border-slate-200 dark:border-brand-cardBorderDark shadow-sm">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by quiz title or game code (e.g. ABC123)..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[#031246] dark:text-[#F7F4FE] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-purple"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['ALL', 'COMPLETED', 'ACTIVE', 'WAITING'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === s
                    ? 'bg-brand-purple text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {s === 'ALL' ? 'All Events' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Event List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-10 h-10 border-3 border-brand-purple/30 border-t-brand-purple rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading quiz events archive...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-16 p-8 rounded-3xl bg-white/60 dark:bg-brand-cardDark/60 border border-dashed border-slate-300 dark:border-brand-cardBorderDark">
            <div className="w-14 h-14 rounded-2xl bg-brand-purple/10 flex items-center justify-center mx-auto mb-4 text-brand-purple">
              <History className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold">
              {searchQuery ? 'No matching quiz events found' : 'No Quiz Events Conducted Yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              {searchQuery
                ? `No event matches "${searchQuery}". Try searching with a different quiz title or game code.`
                : 'Whenever an Organizer launches a live session from the dashboard, it is archived here as a standalone event with complete analytics.'}
            </p>
            <div className="mt-5">
              <Link
                href="/organizer/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-purple hover:bg-[#6A1694] text-white text-xs font-bold transition-all shadow-md"
              >
                <span>Go to Dashboard to Host a Quiz</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHistory.map((event) => {
              const isFinished =
                event.status === 'completed' ||
                event.current_state === 'FINAL_RESULTS' ||
                event.current_state === 'COMPLETED' ||
                Boolean(event.ended_at);

              const isActive = !isFinished && event.current_state !== 'WAITING';

              return (
                <div
                  key={event.id}
                  className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-brand-cardDark border border-slate-200 dark:border-brand-cardBorderDark shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5"
                >
                  {/* Left Column: Title, Code, Status & Timing */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-sm font-black px-2.5 py-1 rounded-lg bg-brand-purple/10 text-brand-purple dark:text-purple-300 border border-brand-purple/20">
                        {event.game_code}
                      </span>

                      {isFinished ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>COMPLETED</span>
                        </span>
                      ) : isActive ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 animate-pulse">
                          <Radio className="w-3 h-3" />
                          <span>LIVE ACTIVE</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>WAITING TO START</span>
                        </span>
                      )}

                      <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                        ID: {event.id.slice(0, 8)}...
                      </span>
                    </div>

                    <h3 className="text-lg font-black tracking-tight">{event.quiz_title}</h3>

                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-brand-purple" />
                        <span>{new Date(event.created_at).toLocaleString()}</span>
                      </span>
                      {event.ended_at && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Ended: {new Date(event.ended_at).toLocaleTimeString()}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle Column: Key Metrics */}
                  <div className="flex items-center gap-6 py-2 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 self-stretch sm:self-auto justify-around sm:justify-start">
                    <div className="text-center sm:text-left">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Users className="w-3 h-3 text-brand-purple" />
                        <span>Participants</span>
                      </p>
                      <p className="text-base font-black mt-0.5">{event.total_participants}</p>
                    </div>

                    <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />

                    <div className="text-center sm:text-left">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Award className="w-3 h-3 text-amber-500" />
                        <span>Avg Score</span>
                      </p>
                      <p className="text-base font-black mt-0.5">{event.average_score} <span className="text-[10px] text-slate-400 font-normal">pts</span></p>
                    </div>

                    <div className="h-7 w-px bg-slate-200 dark:bg-slate-700" />

                    <div className="text-center sm:text-left">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Questions</p>
                      <p className="text-base font-black mt-0.5">{event.total_questions}</p>
                    </div>
                  </div>

                  {/* Right Column: Actions (Analytics, Exports, Live Console) */}
                  <div className="flex items-center gap-2 flex-wrap self-stretch lg:self-auto justify-end">
                    {/* View Full Analytics & Leaderboard */}
                    <Link
                      href={`/organizer/history/${event.game_code}`}
                      className="px-3.5 py-2 rounded-xl bg-brand-purple hover:bg-[#6A1694] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Analytics & Results</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>

                    {/* Quick Exports */}
                    <div className="flex items-center gap-1">
                      <a
                        href={`/api/sessions/${event.game_code}/export/csv`}
                        download
                        title="Download CSV"
                        className="p-2 rounded-xl bg-emerald-700/10 hover:bg-emerald-700/20 text-emerald-700 dark:text-emerald-400 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                      <a
                        href={`/api/sessions/${event.game_code}/export/excel`}
                        download
                        title="Download Excel (.xlsx)"
                        className="p-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-300 transition-colors"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </a>
                      <a
                        href={`/api/sessions/${event.game_code}/export/pdf`}
                        download
                        title="Download PDF"
                        className="p-2 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    </div>

                    {/* Delete Event Button */}
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setEventToDelete(event);
                      }}
                      title="Delete this quiz event"
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Resume Live Console if Active/Waiting */}
                    {!isFinished && (
                      <Link
                        href={`/organizer/session/${event.game_code}`}
                        className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-brand-cardDark hover:bg-brand-purple hover:text-white text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 transition-all"
                        title="Open Live Host Console"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Host Console</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Event Confirmation Modal */}
      {eventToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-brand-cardDark border border-slate-200 dark:border-brand-cardBorderDark rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black">Delete Quiz Event</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Irreversible Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to delete this specific quiz event? This will permanently remove its live session records, participant submissions, and results.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5 font-mono">
              <div><span className="text-slate-400 font-sans font-bold">Quiz:</span> {eventToDelete.quiz_title}</div>
              <div><span className="text-slate-400 font-sans font-bold">Game Code:</span> <span className="font-bold text-brand-purple">{eventToDelete.game_code}</span></div>
              <div><span className="text-slate-400 font-sans font-bold">Event ID:</span> {eventToDelete.id}</div>
              <div><span className="text-slate-400 font-sans font-bold">Date:</span> {new Date(eventToDelete.created_at).toLocaleString()}</div>
              <div><span className="text-slate-400 font-sans font-bold">Participants:</span> {eventToDelete.total_participants}</div>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
              <strong>Notice:</strong> The original quiz template itself will <strong>NOT</strong> be deleted and remains available for future quiz sessions.
            </div>

            {deleteError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEventToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEvent}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete This Event</span>
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
