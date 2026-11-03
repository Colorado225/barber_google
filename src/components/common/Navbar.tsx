import React, { useState } from 'react';
import { useApp, UserRole } from '../../context/AppContext';
import {
  Scissors,
  Calendar,
  Building2,
  Store,
  Menu,
  X,
  ChevronDown,
  UserCheck
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    mode,
    setMode,
    userRole,
    setUserRole,
    activeSalon,
    setIsRegisterSalonOpen,
    setIsClientAppointmentsOpen,
    isRegisteredInErp,
    setIsRegisteredInErp
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const roleLabels: Record<UserRole, { label: string; badge: string }> = {
    owner: { label: 'Propriétaire (Owner)', badge: 'Admin Total' },
    manager: { label: 'Manager Salon', badge: 'Gestion' },
    barber: { label: 'Barbier / Collaborateur', badge: 'Planning' },
    cashier: { label: 'Caissier', badge: 'Caisse' },
    customer: { label: 'Client', badge: 'Marketplace' }
  };

  // Admin Total n'est visible UNIQUEMENT que si l'utilisateur est déjà inscrit dans l'ERP
  const visibleRoles = (Object.keys(roleLabels) as UserRole[]).filter((r) => {
    if (r === 'owner' && !isRegisteredInErp) {
      return false; // Masquer le bouton Admin Total
    }
    return true;
  });

  const currentDisplayRole = (!isRegisteredInErp && userRole === 'owner') ? 'customer' : userRole;

  return (
    <header className="sticky top-0 z-40 w-full bg-[#101010]/95 backdrop-blur-md border-b border-[#232326]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setMode('marketplace')}
            className="flex items-center gap-3 group focus:outline-none text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#1b1a17] border border-[#C9A45C]/40 flex items-center justify-center text-[#C9A45C] group-hover:scale-105 transition-all shadow-[0_0_15px_rgba(201,164,92,0.15)]">
              <Scissors className="w-5 h-5 rotate-90" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white flex items-center">
                Barber<span className="text-[#C9A45C]">Cuts</span>
              </span>
              <span className="text-[10px] text-[#8A8A8A] uppercase tracking-wider font-medium">
                {mode === 'erp' ? 'Business ERP' : 'Marketplace Afrique'}
              </span>
            </div>
          </button>

          {/* Current Salon Badge in ERP mode */}
          {mode === 'erp' && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-[#18181b] border border-[#2d2d32] text-xs text-stone-300">
              <Building2 className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span className="font-medium text-white">{activeSalon.name}</span>
              <span className="text-stone-500">• {activeSalon.commune}</span>
            </div>
          )}
        </div>

        {/* Center / Right Desktop Navigation */}
        <div className="hidden md:flex items-center gap-4">
          {mode === 'marketplace' ? (
            <>
              <button
                onClick={() => setMode('marketplace')}
                className="text-sm font-medium text-white hover:text-[#C9A45C] transition-colors px-3 py-2"
              >
                Explorer
              </button>

              <button
                onClick={() => setIsClientAppointmentsOpen(true)}
                className="text-sm font-medium text-stone-300 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-2"
              >
                <Calendar className="w-4 h-4 text-[#C9A45C]" />
                Mes réservations
              </button>

              <button
                onClick={() => setMode('erp')}
                className="text-sm font-medium text-stone-300 hover:text-[#C9A45C] transition-colors px-3 py-2 flex items-center gap-1.5"
              >
                <Store className="w-4 h-4 text-stone-400" />
                Pour les professionnels
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setMode('marketplace')}
                className="text-sm font-medium text-stone-300 hover:text-[#C9A45C] transition-colors flex items-center gap-1.5 px-3 py-2"
              >
                <Store className="w-4 h-4 text-[#C9A45C]" />
                Voir la Marketplace
              </button>
            </>
          )}

          {/* Role selector dropdown for live demo/testing */}
          <div className="relative">
            <button
              onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1a1d] border border-[#2c2c30] text-xs text-stone-300 hover:border-[#C9A45C]/50 transition-colors"
              title="Changer de rôle pour tester les vues"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#C9A45C]" />
              <span className="font-medium">{roleLabels[currentDisplayRole].badge}</span>
              <ChevronDown className="w-3 h-3 text-stone-400" />
            </button>

            {roleDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#18181b] border border-[#2e2e34] shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setRoleDropdownOpen(false)}
              >
                {/* ERP Registration status toggle (to test and verify the masking) */}
                <div className="px-3 py-2 border-b border-[#26262a] bg-[#141416]/60">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold">
                      Inscrit dans l'ERP :
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isRegisteredInErp;
                        setIsRegisteredInErp(next);
                        if (!next && userRole === 'owner') {
                          setUserRole('customer');
                          setMode('marketplace');
                        }
                      }}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                        isRegisteredInErp
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-600/40'
                          : 'bg-red-950/80 text-red-400 border-red-600/40'
                      }`}
                      title="Cliquer pour simuler utilisateur inscrit ou non inscrit dans l'ERP"
                    >
                      {isRegisteredInErp ? '✓ Oui (Inscrit)' : '✕ Non (Visiteur)'}
                    </button>
                  </div>
                  <p className="text-[9px] text-stone-500 mt-1">
                    {isRegisteredInErp
                      ? 'Bouton "Admin Total" accessible pour ce compte.'
                      : 'Bouton "Admin Total" masqué car non inscrit.'}
                  </p>
                </div>

                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-stone-400 font-semibold border-b border-[#26262a]">
                  Rôles disponibles
                </div>

                {visibleRoles.map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setUserRole(role);
                      setRoleDropdownOpen(false);
                      if (role === 'customer' && mode === 'erp') {
                        setMode('marketplace');
                      } else if (role !== 'customer' && mode === 'marketplace') {
                        setMode('erp');
                      }
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-[#232328] transition-colors ${
                      userRole === role ? 'text-[#C9A45C] font-semibold bg-[#232328]/60' : 'text-stone-300'
                    }`}
                  >
                    <span>{roleLabels[role].label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      role === 'owner' ? 'bg-[#C9A45C] text-[#101010]' : 'bg-[#2c2c32] text-stone-300'
                    }`}>
                      {roleLabels[role].badge}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Primary Action Button */}
          {mode === 'marketplace' ? (
            <button
              onClick={() => setIsRegisterSalonOpen(true)}
              className="bg-[#C9A45C] hover:bg-[#d6b36a] text-[#101010] font-semibold text-sm px-4 py-2.5 rounded-lg shadow-sm hover:shadow-[0_0_20px_rgba(201,164,92,0.3)] transition-all flex items-center gap-2 cursor-pointer"
            >
              <Store className="w-4 h-4" />
              Inscrire mon salon
            </button>
          ) : (
            <button
              onClick={() => setMode('marketplace')}
              className="bg-[#232328] hover:bg-[#2e2e34] text-white border border-[#393940] font-medium text-sm px-4 py-2 rounded-lg transition-colors"
            >
              Quitter l'ERP
            </button>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          {mode === 'marketplace' ? (
            <button
              onClick={() => setIsRegisterSalonOpen(true)}
              className="bg-[#C9A45C] text-[#101010] font-semibold text-xs px-2.5 py-1.5 rounded-lg"
            >
              Inscrire
            </button>
          ) : (
            <button
              onClick={() => setMode('marketplace')}
              className="bg-[#232328] text-white text-xs px-2.5 py-1.5 rounded-lg"
            >
              Marketplace
            </button>
          )}

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-[#18181b] border border-[#2c2c30] text-stone-300 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#141416] border-b border-[#232326] px-4 pt-3 pb-6 space-y-3">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setMode('marketplace');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left py-2.5 px-3 rounded-lg text-sm text-stone-200 hover:bg-[#1e1e22]"
            >
              Explorer les salons
            </button>

            <button
              onClick={() => {
                setIsClientAppointmentsOpen(true);
                setMobileMenuOpen(false);
              }}
              className="w-full text-left py-2.5 px-3 rounded-lg text-sm text-stone-200 hover:bg-[#1e1e22] flex items-center justify-between"
            >
              <span>Mes réservations</span>
              <Calendar className="w-4 h-4 text-[#C9A45C]" />
            </button>

            <button
              onClick={() => {
                setMode('erp');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left py-2.5 px-3 rounded-lg text-sm text-[#C9A45C] bg-[#1a1915] border border-[#C9A45C]/30 flex items-center justify-between"
            >
              <span>Accéder à l'ERP Salon</span>
              <Store className="w-4 h-4" />
            </button>
          </div>

          <div className="pt-3 border-t border-[#26262a]">
            <p className="text-[11px] uppercase tracking-wider text-stone-400 font-semibold mb-2">
              Rôle actif pour le test
            </p>
            <div className="grid grid-cols-2 gap-2">
              {visibleRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => {
                    setUserRole(role);
                    setMobileMenuOpen(false);
                    if (role === 'customer' && mode === 'erp') setMode('marketplace');
                    if (role !== 'customer' && mode === 'marketplace') setMode('erp');
                  }}
                  className={`text-xs py-2 px-2.5 rounded-lg border text-left ${
                    userRole === role
                      ? 'bg-[#C9A45C]/15 border-[#C9A45C] text-[#C9A45C]'
                      : 'bg-[#1a1a1d] border-[#2a2a2e] text-stone-400'
                  }`}
                >
                  <div className="font-semibold">{roleLabels[role].badge}</div>
                  <div className="text-[10px] opacity-75">{roleLabels[role].label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
