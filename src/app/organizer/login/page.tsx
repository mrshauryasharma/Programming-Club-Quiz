'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ShieldCheck, Lock, ArrowRight, AlertCircle } from 'lucide-react';

export default function OrganizerLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/organizer/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      router.push('/organizer/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-b from-[#F8FAFC] via-white to-[#F1F5F9] text-[#031246]">
      {/* Top Bar */}
      <header className="w-full max-w-md mx-auto flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-full overflow-hidden border border-brand-purple/30">
            <Image src="/logo.png" alt="Logo" fill className="object-contain" priority />
          </div>
          <div>
            <h1 className="text-xs font-bold uppercase text-brand-purple">USICT GBU</h1>
            <p className="text-[10px] text-slate-500 font-medium">Programming Club</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Login Card */}
      <div className="w-full max-w-md mx-auto my-auto py-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-xl shadow-slate-200/60 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-purple/10 text-brand-purple flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-black tracking-tight text-brand-navy">Organizer Portal</h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Authorized access for Programming Club Organizers
          </p>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                Access Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter organizer password"
                  required
                  className="w-full px-4 py-3 pl-10 rounded-xl text-sm bg-slate-50 border border-slate-300 focus:bg-white focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20 outline-none transition-all"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-brand-purple to-brand-indigo hover:from-[#6A1694] hover:to-[#2F2766] text-white shadow-lg shadow-brand-purple/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>AUTHENTICATE & ENTER</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      <footer className="w-full max-w-md mx-auto text-center py-2 text-[11px] text-slate-500">
        <p>Protected Organizer Route • Programming Club</p>
      </footer>
    </main>
  );
}
