import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  AlertTriangle,
  Sparkles,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { loginSuperAdmin, type AdminUser } from '../../lib/superadmin';

interface AdminLoginFormProps {
  onSuccess: (admin: AdminUser) => void;
}

export const AdminLoginForm: React.FC<AdminLoginFormProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('admin@barbercuts.com');
  const [password, setPassword] = useState('SuperAdmin2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const admin = await loginSuperAdmin(email, password);
      onSuccess(admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifiants invalides.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] flex flex-col justify-center items-center p-4 sm:p-6 text-[#f7f6f2] relative overflow-hidden selection:bg-[#C9A45C] selection:text-[#101010]">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#C9A45C]/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand & Security Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#141418] border border-[#C9A45C]/40 text-[#C9A45C] shadow-2xl shadow-[#C9A45C]/10 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div>
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#C9A45C]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Plateforme BarberCuts</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              Console Super Administrateur
            </h1>
            <p className="text-xs text-stone-400 mt-1">
              Administration centrale des ERPs, des salons partenaires et de la Marketplace.
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl bg-[#0f0f13] border border-[#25252d] p-6 sm:p-8 shadow-2xl space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/50 flex items-start gap-2.5 text-xs text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                Identifiant Administrateur
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@barbercuts.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#08080a] border border-[#26262e] text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
                />
                <Mail className="w-4 h-4 text-stone-500 absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1.5">
                Clé d'Accès / Mot de Passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#08080a] border border-[#26262e] text-xs text-white placeholder-stone-600 focus:outline-none focus:border-[#C9A45C]"
                />
                <Lock className="w-4 h-4 text-stone-500 absolute left-3.5 top-3.5" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-stone-500 hover:text-stone-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(201,164,92,0.25)] cursor-pointer disabled:opacity-50 mt-2"
            >
              {loading ? (
                <span>Vérification de sécurité…</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Accéder à la Console Maître</span>
                </>
              )}
            </button>
          </form>

          {/* Demo Access Helper Box */}
          <div className="p-3.5 rounded-xl bg-[#14141a] border border-[#202028] text-xs space-y-1.5">
            <div className="text-[11px] font-bold text-[#E5C378] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Accès d'évaluation préconfiguré :</span>
            </div>
            <div className="text-[11px] text-stone-400 font-mono">
              E-mail : <span className="text-white">admin@barbercuts.com</span>
            </div>
            <div className="text-[11px] text-stone-400 font-mono">
              Passe : <span className="text-white">SuperAdmin2026!</span>
            </div>
          </div>
        </div>

        {/* Security Warning Notice */}
        <div className="text-center text-[11px] text-stone-500 space-y-1">
          <p>
            Environnement sous surveillance cryptographique et détection d'anomalies.
          </p>
          <p>
            Adresse IP & Session tracées dans le registre de conformité.
          </p>
        </div>
      </div>
    </div>
  );
};
