import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Store, Globe, Eye, QrCode, Scissors, ImageIcon, ArrowRight } from 'lucide-react';

export const ShopView: React.FC = () => {
  const { activeSalon, services, reviews, setSelectedSalonForModal, setMode } = useApp();

  const salonServices = services.filter((s) => s.salonId === activeSalon.id);
  const salonReviews = reviews.filter((r) => r.salonId === activeSalon.id);
  const isPublished = activeSalon.isPublishedOnMarketplace === true;

  const checks = [
    {
      label: 'Au moins une prestation réservable',
      ok: salonServices.length > 0,
      detail: `${salonServices.length} prestation(s)`
    },
    {
      label: 'Adresse renseignée',
      ok: Boolean(activeSalon.address?.trim()),
      detail: activeSalon.address || 'Non renseignée'
    },
    {
      label: 'Contact renseigné',
      ok: Boolean(activeSalon.phone?.trim()),
      detail: activeSalon.phone || 'Non renseigné'
    },
    {
      label: 'Photo de couverture',
      ok: Boolean(activeSalon.coverImage),
      detail: activeSalon.coverImage ? 'Présente' : 'Absente'
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2] flex items-center gap-2">
            <Store className="w-6 h-6 text-[#C9A45C]" />
            Vitrine
          </h1>
          <p className="text-[#a9a9a9] mt-1">Publication sur la marketplace</p>
        </div>

        <span
          className={`self-start text-xs font-bold px-3 py-1.5 rounded-full border ${isPublished
            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-600/40'
            : 'bg-amber-950/80 text-amber-300 border-amber-600/40'
            }`}
        >
          {isPublished ? 'Publiée' : 'Brouillon'}
        </span>
      </div>

      {/* Readiness checklist — real salon data */}
      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-6">
        <h2 className="text-lg font-semibold text-[#f7f6f2] mb-4">
          Prérequis de publication
        </h2>
        <div className="space-y-2">
          {checks.map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between p-3 rounded-lg bg-[#18181b] border border-[#2a2a2b] text-sm"
            >
              <span className="text-[#f7f6f2]">{check.label}</span>
              <span
                className={`text-xs font-semibold ${check.ok ? 'text-emerald-400' : 'text-amber-400'
                  }`}
              >
                {check.detail}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Real vitrine summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-5">
          <div className="flex items-center gap-2 text-[#a9a9a9] text-sm">
            <Scissors className="w-4 h-4 text-[#C9A45C]" />
            <span>Prestations</span>
          </div>
          <p className="text-2xl font-bold text-[#f7f6f2] mt-2">{salonServices.length}</p>
        </div>
        <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-5">
          <div className="flex items-center gap-2 text-[#a9a9a9] text-sm">
            <ImageIcon className="w-4 h-4 text-[#C9A45C]" />
            <span>Photos</span>
          </div>
          <p className="text-2xl font-bold text-[#f7f6f2] mt-2">
            {(activeSalon.galleryItems?.length || activeSalon.gallery?.length || 0)}
          </p>
        </div>
        <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-5">
          <div className="flex items-center gap-2 text-[#a9a9a9] text-sm">
            <Globe className="w-4 h-4 text-[#C9A45C]" />
            <span>Avis clients</span>
          </div>
          <p className="text-2xl font-bold text-[#f7f6f2] mt-2">{salonReviews.length}</p>
        </div>
      </div>

      {/* Actions wired to real behaviour */}
      <div className="bg-[#151516] rounded-xl border border-[#2a2a2b] p-6 space-y-3">
        <h2 className="text-lg font-semibold text-[#f7f6f2]">Actions</h2>

        <button
          onClick={() => {
            setSelectedSalonForModal(activeSalon);
            setMode('marketplace');
          }}
          className="w-full flex items-center justify-between p-3.5 rounded-lg bg-[#18181b] border border-[#2a2a2b] hover:border-[#C9A45C]/50 transition-colors text-sm text-[#f7f6f2] cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#C9A45C]" />
            Voir la fiche publique
          </span>
          <ArrowRight className="w-4 h-4 text-[#a9a9a9]" />
        </button>

        <Link
          to="/app/qr-code"
          className="w-full flex items-center justify-between p-3.5 rounded-lg bg-[#18181b] border border-[#2a2a2b] hover:border-[#C9A45C]/50 transition-colors text-sm text-[#f7f6f2]"
        >
          <span className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-[#C9A45C]" />
            QR code de réservation
          </span>
          <ArrowRight className="w-4 h-4 text-[#a9a9a9]" />
        </Link>
      </div>
    </div>
  );
};
