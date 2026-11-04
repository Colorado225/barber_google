import React from 'react';
import { useApp } from '../../context/AppContext';
import { paymentSignedAmount } from '../../lib/analytics';
import { Calendar, Users, Wallet, Clock } from 'lucide-react';

export const TodayView: React.FC = () => {
  const { activeSalon, appointments, clients, transactions, formatPrice } = useApp();

  const todayStr = new Date().toISOString().slice(0, 10);

  const todayAppointments = appointments
    .filter((a) => a.salonId === activeSalon.id && a.date === todayStr)
    .sort((a, b) => a.time.localeCompare(b.time));

  const todayRevenue = transactions
    .filter(
      (t) => t.salonId === activeSalon.id && t.status === 'completed' && t.date === todayStr
    )
    .reduce((acc, t) => acc + paymentSignedAmount(t), 0);

  const waiting = todayAppointments.filter(
    (a) => a.status === 'pending' || a.status === 'confirmed'
  ).length;

  const salonClientsCount = clients.filter((c) => c.salonId === activeSalon.id).length;

  const cards = [
    {
      label: 'Rendez-vous',
      value: String(todayAppointments.length),
      icon: Calendar,
      color: 'text-[#C9A45C]'
    },
    {
      label: 'Clients',
      value: String(salonClientsCount),
      icon: Users,
      color: 'text-[#C9A45C]'
    },
    {
      label: 'Encaissé',
      value: formatPrice(todayRevenue),
      icon: Wallet,
      color: 'text-emerald-400'
    },
    {
      label: 'En attente',
      value: String(waiting),
      icon: Clock,
      color: 'text-amber-400'
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f7f6f2]">Aujourd'hui</h1>
        <p className="text-[#a9a9a9] mt-1">Vue d'ensemble de votre journée</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-[#151516] p-6 rounded-xl border border-[#2a2a2b]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#a9a9a9]">{card.label}</p>
                  <p className="text-2xl font-bold text-[#f7f6f2] mt-1">{card.value}</p>
                </div>
                <Icon className={`w-8 h-8 ${card.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-6">
        <h2 className="text-lg font-semibold text-[#f7f6f2] mb-4">Planning du jour</h2>
        {todayAppointments.length === 0 ? (
          <div className="text-center py-12 text-[#a9a9a9]">
            Aucun rendez-vous pour aujourd'hui
          </div>
        ) : (
          <div className="space-y-2">
            {todayAppointments.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#18181b] border border-[#2a2a2b] text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[#C9A45C] font-mono text-xs shrink-0">{apt.time}</span>
                  <span className="text-[#f7f6f2] font-medium truncate">{apt.clientName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[#a9a9a9] text-xs hidden sm:inline">{apt.serviceName}</span>
                  <span className="text-[#E5C378] font-semibold">{formatPrice(apt.price)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
