import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOptionalApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { Appointment } from '../../types';
import { DashboardView } from './DashboardView';
import { AppointmentsCalendarView } from './AppointmentsCalendarView';
import { CashRegisterView } from './CashRegisterView';
import { ServicesView } from './ServicesView';
import { StaffView } from './StaffView';
import { FinanceExpensesView } from './FinanceExpensesView';
import { InventoryView } from './InventoryView';
import { SalonProfileSettingsView } from './SalonProfileSettingsView';
import { MarketplaceShowcaseView } from './MarketplaceShowcaseView';
import { SaaSPlanView } from './SaaSPlanView';
import { SalonQrCodeView } from './SalonQrCodeView';
import { ReportsView } from './ReportsView';
import { ClientsView } from './ClientsView';
import { PlanningView } from './PlanningView';
import { LoyaltyView } from './LoyaltyView';
import { NewAppointmentModal } from './NewAppointmentModal';
import { NewPaymentModal } from './NewPaymentModal';
import { WalkInModal } from './WalkInModal';
import { WalkInView } from './WalkInView';
import { OnlineRequestsView } from './OnlineRequestsView';
import { NotificationsView } from './NotificationsView';
import {
  LayoutDashboard,
  Calendar,
  CreditCard,
  Users,
  Scissors,
  UserCheck,
  TrendingDown,
  Package,
  Store,
  Sparkles,
  Building2,
  ChevronDown,
  Plus,
  ArrowLeft,
  Lock,
  Unlock,
  Bell,
  Globe,
  QrCode,
  BarChart3,
  Heart,
  UserPlus,
  Inbox,
  Send,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ErpTab =
  | 'dashboard'
  | 'walk_in'
  | 'online_requests'
  | 'notifications'
  | 'calendar'
  | 'cash'
  | 'crm'
  | 'services'
  | 'staff'
  | 'expenses'
  | 'inventory'
  | 'marketplace_showcase'
  | 'reports'
  | 'loyalty'
  | 'qr_code'
  | 'storefront'
  | 'saas';

/** URL segment for each ERP tab, so views stay shareable and reloadable. */
const TAB_PATHS: Record<ErpTab, string> = {
  dashboard: 'tableau-de-bord',
  walk_in: 'sans-rendez-vous',
  online_requests: 'demandes-en-ligne',
  notifications: 'notifications',
  calendar: 'planning',
  cash: 'caisse',
  crm: 'clients',
  services: 'prestations',
  staff: 'equipe',
  expenses: 'depenses',
  inventory: 'stocks',
  marketplace_showcase: 'vitrine',
  reports: 'rapports',
  loyalty: 'fidelite',
  qr_code: 'qr-code',
  storefront: 'parametres',
  saas: 'abonnement',
};

export const ErpLayout: React.FC = () => {
  const {
    activeSalon,
    salons,
    setActiveSalonId,
    cashSession,
    formatPrice,
    setMode,
    isSyncing,
    syncError,
    reloadWorkspace,
    appointments,
    notifications,
  } = useOptionalApp();
  const { memberships, hasPermission } = useOptionalAuth();

  const [activeTab, setActiveTab] = useState<ErpTab>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const segment = window.location.pathname.split('/app/')[1]?.split('/')[0];
    if (segment === 'marketplace-personnalisation') return 'marketplace_showcase';
    const match = (Object.entries(TAB_PATHS) as [ErpTab, string][]).find(([, path]) => path === segment);
    return match ? match[0] : 'dashboard';
  });
  const [salonDropdownOpen, setSalonDropdownOpen] = useState(false);

  // Quick modals
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [newAppointmentSlot, setNewAppointmentSlot] = useState<{
    date?: string;
    time?: string;
    staffId?: string;
  }>({});
  const [isNewPaymentOpen, setIsNewPaymentOpen] = useState(false);
  const [preselectedAppointment, setPreselectedAppointment] = useState<Appointment | null>(null);

  const canSee = (permission: string) => memberships.length > 0 && hasPermission(permission, activeSalon?.id);

  const navItems: { id: ErpTab; label: string; icon: LucideIcon; permission?: string }[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard, permission: 'dashboard.read' },
    { id: 'walk_in', label: 'Sans rendez-vous', icon: UserPlus, permission: 'appointments.read' },
    { id: 'online_requests', label: 'Demandes en ligne', icon: Inbox, permission: 'appointments.read' },
    { id: 'calendar', label: 'Planning & RDV', icon: Calendar, permission: 'appointments.read' },
    { id: 'notifications', label: 'Notifications clients', icon: Send, permission: 'appointments.read' },
    { id: 'cash', label: 'Caisse & Encaissements', icon: CreditCard, permission: 'payments.read' },
    { id: 'crm', label: 'CRM Clients', icon: Users, permission: 'clients.read' },
    { id: 'services', label: 'Prestations & Tarifs', icon: Scissors, permission: 'services.read' },
    { id: 'staff', label: 'Équipe & Commissions', icon: UserCheck, permission: 'staff.read' },
    { id: 'loyalty', label: 'Fidélité', icon: Heart, permission: 'loyalty.read' },
    { id: 'expenses', label: 'Dépenses & Bilan', icon: TrendingDown, permission: 'expenses.read' },
    { id: 'inventory', label: 'Stocks & Produits', icon: Package, permission: 'stock.read' },
    {
      id: 'marketplace_showcase',
      label: 'Vitrine & Personnalisation',
      icon: Globe,
      permission: 'salon.read',
    },
    { id: 'reports', label: 'Rapports', icon: BarChart3, permission: 'reports.read' },
    { id: 'qr_code', label: 'QR Code Réservation', icon: QrCode, permission: 'salon.read' },
    { id: 'storefront', label: 'Personnalisation Salon', icon: Store, permission: 'salon.update' },
    { id: 'saas', label: 'Abonnement SaaS', icon: Sparkles, permission: 'subscriptions.read' },
  ];

  // Compteurs d'action : demandes à confirmer et messages à traiter.
  const pendingOnline = appointments.filter(
    (a) => a.salonId === activeSalon?.id && a.source === 'marketplace' && a.status === 'pending',
  ).length;
  const pendingNotifications = notifications.filter(
    (n) =>
      n.salonId === activeSalon?.id &&
      (n.status === 'pending' || n.status === 'failed' || n.status === 'skipped'),
  ).length;
  const navBadge = (id: ErpTab): number =>
    id === 'online_requests' ? pendingOnline : id === 'notifications' ? pendingNotifications : 0;

  // Sans session serveur (démonstration locale), tous les onglets restent visibles.
  const visibleNavItems = memberships.length
    ? navItems.filter((i) => !i.permission || canSee(i.permission))
    : navItems;
  const visibleActiveTab = visibleNavItems.some((item) => item.id === activeTab) ? activeTab : 'dashboard';

  useEffect(() => {
    if (visibleActiveTab === activeTab) return;
    setActiveTab(visibleActiveTab);
    window.history.replaceState({}, '', `/app/${TAB_PATHS[visibleActiveTab]}`);
  }, [activeTab, visibleActiveTab]);

  if (memberships.length > 0 && (isSyncing || syncError || activeSalon?.id !== memberships[0].salonId)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] px-4 text-center text-stone-200">
        <div className="max-w-lg space-y-4">
          <h1 className="text-xl font-bold">
            {syncError ? 'Chargement de l’espace impossible' : 'Chargement de votre espace…'}
          </h1>
          {syncError && (
            <p role="alert" className="text-sm text-red-300">
              {syncError}
            </p>
          )}
          {syncError && (
            <button
              type="button"
              onClick={() => void reloadWorkspace(memberships[0].salonId)}
              className="px-5 py-3 rounded-lg bg-[#C9A45C] text-[#101010] font-semibold"
            >
              Réessayer
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!activeSalon) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0e] text-stone-200">
        Chargement de votre salon…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0e] flex flex-col md:flex-row text-stone-200">
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-[#121214] border-r border-[#222226] flex flex-col shrink-0">
        {/* Salon Selector Header */}
        <div className="p-4 border-b border-[#222226] relative">
          <button
            onClick={() => setSalonDropdownOpen(!salonDropdownOpen)}
            className="w-full p-2.5 rounded-xl bg-[#18181b] hover:bg-[#1f1f23] border border-[#2a2a2e] flex items-center justify-between transition-colors text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#201d16] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] shrink-0 font-bold text-xs">
                {activeSalon.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-white truncate">{activeSalon.name}</div>
                <div className="text-[10px] text-stone-400">{activeSalon.commune}</div>
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          </button>

          {/* Salon Switcher Dropdown */}
          {salonDropdownOpen && (
            <div
              className="absolute left-4 right-4 top-18 bg-[#18181b] border border-[#2d2d33] rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95"
              onMouseLeave={() => setSalonDropdownOpen(false)}
            >
              <div className="px-2.5 py-1 text-[10px] uppercase font-bold text-stone-500">
                Vos Établissements (Multi-Tenants)
              </div>
              {salons.map((salon) => (
                <button
                  key={salon.id}
                  onClick={() => {
                    setActiveSalonId(salon.id);
                    setSalonDropdownOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between hover:bg-[#232328] transition-colors ${
                    activeSalon.id === salon.id
                      ? 'text-[#C9A45C] font-bold bg-[#232328]/50'
                      : 'text-stone-300'
                  }`}
                >
                  <span className="truncate">{salon.name}</span>
                  <span className="text-[10px] text-stone-500">{salon.commune}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = visibleActiveTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  // Keep the URL in sync so the view stays shareable / reloadable.
                  window.history.replaceState({}, '', `/app/${TAB_PATHS[item.id]}`);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-[#C9A45C] text-[#101010] shadow-sm font-bold'
                    : 'text-stone-400 hover:text-white hover:bg-[#1a1a1d]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#101010]' : 'text-stone-400'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {navBadge(item.id) > 0 && (
                  <span
                    className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive ? 'bg-[#101010] text-[#C9A45C]' : 'bg-[#C9A45C] text-[#101010]'
                    }`}
                  >
                    {navBadge(item.id)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Cash Register status indicator */}
        <div className="p-3 border-t border-[#222226] space-y-2">
          <div className="p-3 rounded-xl bg-[#161619] border border-[#242428] text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-stone-400">Tiroir Caisse :</span>
              <span
                className={`text-[10px] font-bold ${cashSession?.status === 'open' ? 'text-emerald-400' : 'text-stone-500'}`}
              >
                {cashSession ? (cashSession.status === 'open' ? 'Ouverte' : 'Fermée') : 'Non configurée'}
              </span>
            </div>
            <div className="font-extrabold text-[#E5C378] text-sm">
              {cashSession ? formatPrice(cashSession.theoreticalBalance) : '—'}
            </div>
          </div>

          <button
            onClick={() => setMode('marketplace')}
            className="w-full py-2 px-3 rounded-xl bg-[#18181b] hover:bg-[#202025] text-stone-400 hover:text-white text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour Marketplace</span>
          </button>
        </div>
      </aside>

      {/* MAIN ERP WORKSPACE */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 bg-[#121214] border-b border-[#222226] px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-white capitalize">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
            <span className="text-xs text-stone-500 hidden sm:inline">• {activeSalon.name}</span>
          </div>

          <div className="flex items-center gap-3">
            {(memberships.length === 0 || canSee('appointments.write')) && (
              <button
                onClick={() => setIsWalkInOpen(true)}
                className="bg-[#C9A45C]/15 hover:bg-[#C9A45C]/25 text-[#E5C378] border border-[#C9A45C]/40 font-semibold text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">+ Client de passage</span>
              </button>
            )}
            <button
              onClick={() => {
                setNewAppointmentSlot({});
                setIsNewAppointmentOpen(true);
              }}
              className="bg-[#242429] hover:bg-[#2d2d34] text-white border border-[#3b3b44] font-semibold text-xs px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span className="hidden sm:inline">+ Nouveau RDV</span>
            </button>

            {(memberships.length === 0 || canSee('payments.record')) && (
              <button
                onClick={() => {
                  setPreselectedAppointment(null);
                  setIsNewPaymentOpen(true);
                }}
                className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Encaisser</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <main className="p-4 sm:p-6 lg:p-8 flex-1">
          {visibleActiveTab === 'dashboard' && (
            <DashboardView
              onOpenNewAppointment={() => {
                setNewAppointmentSlot({});
                setIsNewAppointmentOpen(true);
              }}
              onOpenWalkIn={() => setIsWalkInOpen(true)}
              onOpenNewPayment={() => {
                setPreselectedAppointment(null);
                setIsNewPaymentOpen(true);
              }}
            />
          )}

          {visibleActiveTab === 'walk_in' && (
            <WalkInView
              onOpenNewWalkIn={() => setIsWalkInOpen(true)}
              onOpenPayment={(apt) => {
                setPreselectedAppointment(apt);
                setIsNewPaymentOpen(true);
              }}
            />
          )}

          {visibleActiveTab === 'online_requests' && <OnlineRequestsView />}
          {visibleActiveTab === 'notifications' && <NotificationsView />}
          {visibleActiveTab === 'calendar' && <PlanningView onOpenWalkIn={() => setIsWalkInOpen(true)} />}

          {visibleActiveTab === 'cash' && <CashRegisterView />}

          {visibleActiveTab === 'loyalty' && <LoyaltyView />}

          {visibleActiveTab === 'crm' && <ClientsView />}

          {visibleActiveTab === 'services' && <ServicesView />}

          {visibleActiveTab === 'staff' && <StaffView />}

          {visibleActiveTab === 'expenses' && <FinanceExpensesView />}

          {visibleActiveTab === 'inventory' && <InventoryView />}

          {visibleActiveTab === 'marketplace_showcase' && <MarketplaceShowcaseView />}

          {visibleActiveTab === 'reports' && <ReportsView />}

          {visibleActiveTab === 'qr_code' && <SalonQrCodeView />}

          {visibleActiveTab === 'storefront' && <SalonProfileSettingsView />}

          {visibleActiveTab === 'saas' && <SaaSPlanView />}
        </main>
      </div>

      {/* ACCUEIL CLIENT SANS RENDEZ-VOUS */}
      {isWalkInOpen && (
        <WalkInModal onClose={() => setIsWalkInOpen(false)} onCreated={() => setActiveTab('walk_in')} />
      )}

      {/* QUICK NEW APPOINTMENT MODAL */}
      {isNewAppointmentOpen && (
        <NewAppointmentModal
          onClose={() => {
            setIsNewAppointmentOpen(false);
            setNewAppointmentSlot({});
          }}
          initialDate={newAppointmentSlot.date}
          initialTime={newAppointmentSlot.time}
          initialStaffId={newAppointmentSlot.staffId}
        />
      )}

      {/* QUICK NEW PAYMENT MODAL */}
      {isNewPaymentOpen && (
        <NewPaymentModal
          onClose={() => {
            setIsNewPaymentOpen(false);
            setPreselectedAppointment(null);
          }}
          preselectedAppointmentId={preselectedAppointment?.id}
          defaultAmount={preselectedAppointment?.price}
          defaultClientName={preselectedAppointment?.clientName || ''}
        />
      )}
    </div>
  );
};
