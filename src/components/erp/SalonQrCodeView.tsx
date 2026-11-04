import React, { useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useApp } from '../../context/AppContext';
import { useOptionalAuth } from '../../context/AuthContext';
import { buildSalonBookingPath, buildSalonBookingUrl, getSalonLinkKey } from '../../lib/salonLink';
import {
  QrCode,
  Download,
  Copy,
  Check,
  ExternalLink,
  Printer,
  Share2,
  Sparkles,
  Info,
  Eye,
  MapPin,
  Lock,
} from 'lucide-react';

export const SalonQrCodeView: React.FC = () => {
  const { activeSalon, setMode, setSelectedSalonForModal, services, formatPrice, addToast } = useApp();
  const { hasPermission } = useOptionalAuth();

  const [copied, setCopied] = useState(false);
  const [qrSize, setQrSize] = useState(260);
  const qrWrapperRef = useRef<HTMLDivElement>(null);

  const bookingUrl = useMemo(
    () => buildSalonBookingUrl(activeSalon),
    [activeSalon.id, activeSalon.slug, activeSalon.name],
  );
  const publicPath = buildSalonBookingPath(activeSalon);

  // Vitrine state is independent from the ERP activation (§3.3). Only a
  // published shopfront can be booked, so the QR must not pretend otherwise.
  const isPublished = activeSalon.isPublishedOnMarketplace === true;
  const hasBookingService = services.some((s) => s.salonId === activeSalon.id);
  const isQrActive = isPublished && hasBookingService;
  const canManageShopfront = hasPermission('salon.update', activeSalon.id);

  const salonServices = services.filter((s) => s.salonId === activeSalon.id);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      addToast('Lien de réservation copié !', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Impossible de copier le lien automatiquement. Sélectionnez-le manuellement.', 'error');
    }
  };

  const handleDownload = () => {
    const svg = qrWrapperRef.current?.querySelector('svg');
    if (!svg) {
      // Report what actually happened instead of claiming a success.
      addToast('Le QR code n’est pas encore prêt, réessayez dans un instant.', 'error');
      return;
    }

    const serialized = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    const canvas = document.createElement('canvas');
    const padding = 24;
    const exportSize = 1024;
    canvas.width = exportSize;
    canvas.height = exportSize;

    image.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        addToast('La génération du fichier a échoué (canvas indisponible).', 'error');
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportSize, exportSize);
      ctx.drawImage(image, padding, padding, exportSize - padding * 2, exportSize - padding * 2);

      try {
        const link = document.createElement('a');
        link.download = `qr-${getSalonLinkKey(activeSalon)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        addToast('Fichier PNG généré et téléchargé.', 'success');
      } catch {
        addToast('Le navigateur a bloqué le téléchargement du fichier.', 'error');
      }
    };

    image.onerror = () => addToast('Erreur lors de la génération du fichier QR.', 'error');
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
  };

  const handleOpenPreview = () => {
    window.open(bookingUrl, '_blank', 'noopener,noreferrer');
  };

  const handleTestOnMarketplace = () => {
    setSelectedSalonForModal(activeSalon);
    setMode('marketplace');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f7f6f2] flex items-center gap-2">
            <QrCode className="w-6 h-6 text-[#C9A45C]" />
            QR Code de réservation
          </h1>
          <p className="text-[#a9a9a9] mt-1">
            Un seul QR code pour envoyer vos clients directement sur la fiche de réservation de{' '}
            <span className="text-[#C9A45C] font-semibold">{activeSalon.name}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleTestOnMarketplace}
            className="bg-[#232328] hover:bg-[#2d2d34] text-white border border-[#3b3b42] text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Eye className="w-4 h-4 text-[#C9A45C]" />
            Tester sur la marketplace
          </button>
          <button
            onClick={handleOpenPreview}
            className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            Ouvrir le lien
          </button>
        </div>
      </div>

      {!isPublished && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/30 text-amber-200 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Votre vitrine est en <strong className="text-white">brouillon</strong> : ce QR code pointera vers
            une fiche qui n’est pas encore publique. Publiez la vitrine avant de diffuser l’affiche à vos
            clients.
          </span>
        </div>
      )}

      {isPublished && !hasBookingService && (
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-600/30 text-amber-200 text-xs flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            Aucune prestation active : la fiche publique ne peut pas encore recevoir de réservation. Ajoutez
            au moins une prestation dans « Prestations &amp; Tarifs ».
          </span>
        </div>
      )}

      {!canManageShopfront && (
        <div className="p-3.5 rounded-xl bg-[#18181b] border border-[#2d2d33] text-stone-300 text-xs flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
          <span>
            Consultation uniquement : la gestion de la vitrine publique est réservée au propriétaire et au
            manager du salon.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR CARD */}
        <div className="bg-[#151516] rounded-2xl border border-[#2a2a2b] p-6 flex flex-col items-center text-center">
          <div id="salon-qr-code" ref={qrWrapperRef} className="p-5 bg-white rounded-2xl shadow-2xl">
            <QRCodeSVG
              value={bookingUrl}
              size={qrSize}
              level="H"
              marginSize={0}
              bgColor="#ffffff"
              fgColor="#101010"
            />
          </div>

          <div className="mt-5 space-y-1">
            <p className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#C9A45C]" />
              {activeSalon.name}
            </p>
            <p className="text-xs text-[#a9a9a9]">
              {activeSalon.commune} · {activeSalon.city}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={handleDownload}
              disabled={!isQrActive}
              title={isQrActive ? undefined : 'Disponible après publication de la vitrine'}
              className="bg-[#C9A45C] hover:bg-[#d8b56d] text-[#101010] text-xs font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#C9A45C]"
            >
              <Download className="w-4 h-4" />
              Télécharger PNG
            </button>
            <button
              onClick={() => window.print()}
              className="bg-[#232328] hover:bg-[#2d2d34] text-white border border-[#3b3b42] text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#C9A45C]" />
              Imprimer
            </button>
          </div>

          {/* Size presets */}
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#111113] border border-[#25252a] p-1">
            {[
              { size: 180, label: 'S' },
              { size: 260, label: 'M' },
              { size: 340, label: 'L' },
            ].map((preset) => (
              <button
                key={preset.size}
                onClick={() => setQrSize(preset.size)}
                className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                  qrSize === preset.size ? 'bg-[#C9A45C] text-[#101010]' : 'text-[#a9a9a9] hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-stone-500 mt-2">
            Taille d’affichage — le fichier téléchargé est toujours en haute résolution.
          </p>
        </div>

        {/* LINK & USAGE */}
        <div className="space-y-6">
          <div className="bg-[#151516] rounded-2xl border border-[#2a2a2b] p-6 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-[#C9A45C]" />
                Lien de réservation
              </h3>
              <p className="text-xs text-[#a9a9a9] mt-1">
                Ce lien est unique à votre salon et ouvre directement votre profil de réservation.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                readOnly
                value={bookingUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 bg-[#101012] border border-[#2a2a2e] rounded-xl px-3 py-2.5 text-xs text-stone-200 font-mono focus:outline-none focus:border-[#C9A45C]"
                aria-label="Lien de réservation du salon"
              />
              <button
                onClick={handleCopy}
                className="bg-[#232328] hover:bg-[#2d2d34] text-white border border-[#3b3b42] text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    Copié
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#C9A45C]" />
                    Copier
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1">
              <span>Chemin public sur le marketplace</span>
              <span className="font-mono text-[#E5C378]">{publicPath}</span>
            </div>
          </div>

          <div className="bg-[#151516] rounded-2xl border border-[#2a2a2b] p-6 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C9A45C]" />
              Où afficher votre QR code
            </h3>
            <ul className="space-y-2 text-xs text-[#a9a9a9]">
              {[
                'En affiche A5 sur le comptoir et près des fauteuils',
                'Sur les cartes de visite et les tickets de caisse',
                'En story et bio Instagram, TikTok ou WhatsApp Business',
                'Sur les vitrines des succursales et flyers de quartier',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-[#C9A45C] shrink-0 mt-0.5" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#151516] rounded-2xl border border-[#2a2a2b] p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Aperçu de la fiche cible</h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isPublished
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-600/40'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-600/40'
                }`}
              >
                {isPublished ? 'Publié' : 'Brouillon'}
              </span>
            </div>
            <p className="text-xs text-[#a9a9a9] leading-relaxed line-clamp-2">
              {activeSalon.tagline || activeSalon.description}
            </p>
            <div className="flex items-center justify-between text-[11px] text-stone-400 pt-2 border-t border-[#242428]">
              <span>{salonServices.length} prestation(s) réservable(s)</span>
              <span>
                {activeSalon.minPrice !== undefined
                  ? `À partir de ${formatPrice(activeSalon.minPrice)}`
                  : 'Tarif non renseigné'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
