import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PublicSalonDetail, SalonMarketplaceViewConfig, Service } from '../../../types';
import { getMarketplaceSalonDetail } from '../../../lib/marketplace';
import { getDefaultCustomizerConfig } from '../../../lib/marketplace-customizer';
import { buildSalonSeoMetadata, resolvePageMetadata, type PageSeoMetadata } from '../../../lib/seo';
import { usePageSeo } from '../../../hooks/useSiteMetadata';
import { ClassicSalonLayout } from './layouts/ClassicSalonLayout';
import { ElegantSalonLayout } from './layouts/ElegantSalonLayout';
import { EditorialSalonLayout } from './layouts/EditorialSalonLayout';
import { SalonDetailModal } from '../SalonDetailModal';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';

interface SalonPublicPageProps {
  initialDetail?: PublicSalonDetail | null;
  onOpenBookingModal?: (serviceId?: string, staffId?: string) => void;
}

export const SalonPublicPage: React.FC<SalonPublicPageProps> = ({ initialDetail, onOpenBookingModal }) => {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<PublicSalonDetail | null>(initialDetail || null);
  const [loading, setLoading] = useState<boolean>(!initialDetail && Boolean(slug));
  const [error, setError] = useState<string | null>(null);

  // Direct modal booking flow for public visitors
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [preselectedService, setPreselectedService] = useState<Service | null>(null);
  const [preselectedStaffId, setPreselectedStaffId] = useState<string>('any');

  const seoMetadata = useMemo<PageSeoMetadata>(() => {
    if (detail && detail.salon.status !== 'suspended') {
      return buildSalonSeoMetadata(detail);
    }
    const slugPath = slug ? `/salons/${encodeURIComponent(slug)}` : '/salons';
    if (error) {
      return {
        ...resolvePageMetadata(slugPath, {
          siteName: 'BarberCuts',
          metaTitle: 'Salon indisponible | BarberCuts',
          metaDescription: "Cet établissement n'est plus disponible sur la marketplace BarberCuts.",
        }),
        canonicalPath: slugPath,
        title: 'Salon indisponible | BarberCuts',
        ogTitle: 'Salon indisponible | BarberCuts',
        description: "Cet établissement n'est plus disponible sur la marketplace BarberCuts.",
        ogDescription: "Cet établissement n'est plus disponible sur la marketplace BarberCuts.",
        robots: 'noindex, nofollow',
        jsonLd: null,
      };
    }
    return {
      ...resolvePageMetadata('/', {
        siteName: 'BarberCuts',
        metaTitle: 'Fiche salon | BarberCuts',
        metaDescription:
          'Découvrez les prestations, les tarifs et réservez votre rendez-vous en ligne sur BarberCuts.',
      }),
      canonicalPath: slugPath,
      title: 'Fiche salon | BarberCuts',
      ogTitle: 'Fiche salon | BarberCuts',
      description:
        'Découvrez les prestations, les tarifs et réservez votre rendez-vous en ligne sur BarberCuts.',
      ogDescription:
        'Découvrez les prestations, les tarifs et réservez votre rendez-vous en ligne sur BarberCuts.',
      jsonLd: null,
    };
  }, [detail, error, slug]);

  usePageSeo(seoMetadata);

  useEffect(() => {
    if (initialDetail) {
      setDetail(initialDetail);
      return;
    }
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getMarketplaceSalonDetail(slug)
      .then((data) => {
        if (cancelled) return;
        if (data.salon.status === 'suspended') {
          setError("Cet établissement n'est plus disponible sur la marketplace.");
          return;
        }
        setDetail(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossible de charger la vitrine publique de cet établissement.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, initialDetail]);

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-3 text-stone-400">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A45C]" />
        <p className="text-sm">Chargement de la vitrine officielle...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 rounded-3xl bg-[#161619] border border-stone-800 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Vitrine non disponible</h2>
        <p className="text-sm text-stone-400">
          {error || "Ce salon n'est pas encore publié sur la marketplace."}
        </p>
        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à la marketplace</span>
          </Link>
        </div>
      </div>
    );
  }

  const config: SalonMarketplaceViewConfig = detail.customizer || getDefaultCustomizerConfig(detail.salon.id);

  const handleBookNow = () => {
    setPreselectedService(null);
    setPreselectedStaffId('any');
    if (onOpenBookingModal) {
      onOpenBookingModal();
    } else {
      setIsBookingModalOpen(true);
    }
  };

  const handleSelectService = (service: Service) => {
    setPreselectedService(service);
    setPreselectedStaffId('any');
    if (onOpenBookingModal) {
      onOpenBookingModal(service.id);
    } else {
      setIsBookingModalOpen(true);
    }
  };

  const handleSelectStaff = (staffId: string) => {
    setPreselectedStaffId(staffId);
    if (onOpenBookingModal) {
      onOpenBookingModal(undefined, staffId);
    } else {
      setIsBookingModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d0d0e] text-[#f7f6f2] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation breadcrumb */}
        <div className="flex items-center justify-between text-xs text-stone-400">
          <Link to="/" className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Marketplace Barber Cuts</span>
          </Link>

          <span className="text-[11px] px-2.5 py-1 rounded-full bg-stone-900 border border-stone-800 text-stone-400">
            Vitrine officielle vérifiée
          </span>
        </div>

        {/* Dynamic Model Layout Rendering */}
        {config.layout === 'elegant' && (
          <ElegantSalonLayout
            detail={detail}
            config={config}
            onBookNow={handleBookNow}
            onSelectService={handleSelectService}
            onSelectStaff={handleSelectStaff}
          />
        )}

        {config.layout === 'editorial' && (
          <EditorialSalonLayout
            detail={detail}
            config={config}
            onBookNow={handleBookNow}
            onSelectService={handleSelectService}
            onSelectStaff={handleSelectStaff}
          />
        )}

        {(config.layout === 'classic' || !['elegant', 'editorial'].includes(config.layout)) && (
          <ClassicSalonLayout
            detail={detail}
            config={config}
            onBookNow={handleBookNow}
            onSelectService={handleSelectService}
            onSelectStaff={handleSelectStaff}
          />
        )}
      </div>

      {/* Integrated Booking Modal */}
      {isBookingModalOpen && (
        <SalonDetailModal
          salon={detail.salon}
          initialDetail={detail}
          initialServiceId={preselectedService?.id}
          initialStaffId={preselectedStaffId}
          onClose={() => {
            setIsBookingModalOpen(false);
            setPreselectedService(null);
            setPreselectedStaffId('any');
          }}
        />
      )}
    </div>
  );
};
