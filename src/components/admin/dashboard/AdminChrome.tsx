// Chrome de la console SuperAdmin : en-tête applicatif (session, actions)
// et barre latérale de navigation avec indicateurs de comptage.
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Bell,
  CreditCard,
  DollarSign,
  Eye,
  FileText,
  Globe,
  LogOut,
  MessageSquare,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sliders,
  Store,
  TrendingUp,
} from 'lucide-react';
import type { PlatformMetrics, SaaSPlan } from '../../../types';
import type {
  AdminUser,
  AuditLogEntry,
  MarketplaceReviewItem,
  SalonAdminDetail,
} from '../../../lib/superadmin';
import type { AdminDashboardTab } from '../AdminDashboard';

export const AdminHeader: React.FC<{
  adminSession: AdminUser;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}> = ({ adminSession: session, loading, onRefresh, onLogout }) => (
  <header className="h-16 bg-[#0c0c10] border-b border-[#1c1c24] px-4 sm:px-8 flex items-center justify-between shrink-0 sticky top-0 z-40">
    <div className="flex items-center gap-3 sm:gap-4">
      <div className="w-9 h-9 rounded-xl bg-[#171612] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C]">
        <ShieldCheck className="w-5 h-5" />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-sm sm:text-base text-white tracking-tight">
            Barber<span className="text-[#C9A45C]">Cuts</span>
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#C9A45C]/20 text-[#E5C378] border border-[#C9A45C]/30 hidden sm:inline">
            Admin Dashboard
          </span>
        </div>
        <span className="text-[10px] text-stone-500 hidden sm:block">
          Supervision Générale de la Plateforme SaaS & Marketplace
        </span>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141418] hover:bg-[#1c1c22] border border-[#26262e] text-xs font-semibold text-stone-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 text-[#C9A45C] ${loading ? 'animate-spin' : ''}`} />
        <span>Actualiser</span>
      </button>
      <Link
        to="/tarifs"
        target="_blank"
        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141418] hover:bg-[#1c1c22] border border-[#26262e] text-xs font-semibold text-stone-300 hover:text-white transition-colors"
      >
        <Eye className="w-3.5 h-3.5 text-[#C9A45C]" />
        <span>Tarifs Publics</span>
      </Link>
      <Link
        to="/"
        target="_blank"
        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141418] hover:bg-[#1c1c22] border border-[#26262e] text-xs font-semibold text-stone-300 hover:text-white transition-colors"
      >
        <Globe className="w-3.5 h-3.5 text-[#C9A45C]" />
        <span>Marketplace</span>
      </Link>

      <div className="h-4 w-px bg-[#26262e] hidden md:block" />

      <div className="flex items-center gap-2">
        <div className="text-right hidden sm:block">
          <div className="text-xs font-bold text-white">{session.name}</div>
          <div className="text-[10px] text-[#C9A45C]">{session.email}</div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 border border-red-800/40 text-xs font-bold text-red-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Déconnexion sécurisée"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </div>
  </header>
);

export const AdminSidebar: React.FC<{
  activeTab: AdminDashboardTab;
  onSelectTab: (tab: AdminDashboardTab) => void;
  salons: SalonAdminDetail[];
  reviews: MarketplaceReviewItem[];
  auditLogs: AuditLogEntry[];
  plans: SaaSPlan[];
  notificationAlertCount: number;
  hiddenReviewsCount: number;
  metrics: PlatformMetrics | null;
  formatPrice: (amount: number) => string;
  /** Contenu principal (panneau actif), affiché à droite de la navigation. */
  children?: React.ReactNode;
}> = ({
  activeTab,
  onSelectTab,
  salons,
  reviews,
  auditLogs,
  plans,
  notificationAlertCount,
  hiddenReviewsCount,
  metrics,
  formatPrice,
  children,
}) => (
  <div className="flex-1 flex flex-col md:flex-row min-w-0">
    {/* Navigation Sidebar */}
    <aside className="w-full md:w-64 bg-[#0a0a0d] border-r border-[#1a1a22] p-4 flex flex-col shrink-0 space-y-6">
      <div className="space-y-1">
        <div className="text-[10px] uppercase font-extrabold tracking-wider text-stone-500 px-3">
          Navigation Plateforme
        </div>
        <nav className="space-y-1">
          {[
            { id: 'overview', label: 'Vue d’Ensemble', icon: Activity },
            { id: 'salons', label: 'Gestion des Salons', icon: Store, count: salons.length },
            {
              id: 'reviews',
              label: 'Modération des Avis',
              icon: MessageSquare,
              count: reviews.length,
            },
            {
              id: 'notifications',
              label: 'Notifications & Alertes',
              icon: Bell,
              count: notificationAlertCount > 0 ? notificationAlertCount : undefined,
            },
            { id: 'audit', label: 'Journal d’Audit', icon: FileText, count: auditLogs.length },
            { id: 'marketplace-sections', label: 'Sections Marketplace', icon: Globe },
            { id: 'marketplace-config', label: 'Bannières & Métadonnées', icon: Sliders },
            { id: 'pricing', label: 'Tarifs & Plans SaaS', icon: DollarSign, count: plans.length },
            {
              id: 'subscriptions',
              label: 'Statuts d’Abonnement',
              icon: CreditCard,
              count: salons.length,
            },
            { id: 'settings', label: 'Paramètres Globaux', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id as AdminDashboardTab)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#C9A45C] text-[#101010] shadow-sm'
                    : 'text-stone-400 hover:text-white hover:bg-[#121217]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-[#101010] text-[#C9A45C]' : 'bg-[#181820] text-stone-300'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-3.5 rounded-2xl bg-[#0f0f13] border border-[#1e1e26] space-y-2 mt-auto">
        <div className="flex items-center justify-between text-[11px] font-bold text-stone-400">
          <span>MRR Normalisé (actifs)</span>
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="text-lg font-black text-white">
          {metrics ? formatPrice(metrics.estimatedMrrXof) : '—'}
        </div>
        <div className="text-[10px] text-stone-500">
          {metrics
            ? `${metrics.activeSubscriptions} abonnement(s) actif(s) · annuels ÷ 12`
            : `${salons.filter((s) => s.status === 'active').length} établissement(s) actif(s)`}{' '}
          · {hiddenReviewsCount} avis masqué(s)
        </div>
      </div>
    </aside>
    {children}
  </div>
);
