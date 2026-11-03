import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Calendar,
  CalendarDays,
  Users,
  Scissors,
  UserCog,
  Package,
  Receipt,
  BarChart3,
  Heart,
  Store,
  Settings,
  CreditCard,
  Home,
  QrCode,
} from 'lucide-react';

const menuItems = [
  { path: '/app/aujourdhui', icon: Home, label: "Aujourd'hui" },
  { path: '/app/planning', icon: CalendarDays, label: 'Planning' },
  { path: '/app/clients', icon: Users, label: 'Clients' },
  { path: '/app/caisse', icon: Receipt, label: 'Caisse' },
  { path: '/app/prestations', icon: Scissors, label: 'Prestations' },
  { path: '/app/equipe', icon: UserCog, label: 'Équipe' },
  { path: '/app/stocks', icon: Package, label: 'Stocks' },
  { path: '/app/depenses', icon: Calendar, label: 'Dépenses' },
  { path: '/app/rapports', icon: BarChart3, label: 'Rapports' },
  { path: '/app/fidelite', icon: Heart, label: 'Fidélité' },
  { path: '/app/vitrine', icon: Store, label: 'Vitrine' },
  { path: '/app/qr-code', icon: QrCode, label: 'QR Code' },
  { path: '/app/parametres', icon: Settings, label: 'Paramètres' },
  { path: '/app/abonnement', icon: CreditCard, label: 'Abonnement' },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-[#151516] border-r border-[#2a2a2b] h-screen sticky top-0">
      <div className="p-6 border-b border-[#2a2a2b]">
        <h1 className="text-xl font-bold text-[#C9A45C]">Barber Cuts</h1>
        <p className="text-xs text-[#a9a9a9] mt-1">ERP</p>
      </div>
      <nav className="p-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-[#C9A45C]/10 text-[#C9A45C]'
                  : 'text-[#a9a9a9] hover:bg-[#1f1f20] hover:text-[#f7f6f2]'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="text-sm">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
