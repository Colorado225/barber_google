import React from 'react';
import { PublicSalonDetail, SalonMarketplaceViewConfig, Service } from '../../../../types';
import { SalonHero } from '../SalonHero';
import { SalonGalleryCarousel } from '../SalonGalleryCarousel';
import { FeaturedServicesCard } from '../FeaturedServicesCard';
import { SalonTeamShowcase } from '../SalonTeamShowcase';
import { SalonTrustCard } from '../SalonTrustCard';
import { SalonLocationHoursCard } from '../SalonLocationHoursCard';
import { SalonReviewsSection } from '../SalonReviewsSection';
import { MotionPreset } from '../../../ui/motion-preset';

interface LayoutProps {
  detail: PublicSalonDetail;
  config: SalonMarketplaceViewConfig;
  onBookNow?: () => void;
  onSelectService?: (service: Service) => void;
  onSelectStaff?: (staffId: string) => void;
  formatPrice?: (amount: number) => string;
}

export const ElegantSalonLayout: React.FC<LayoutProps> = ({
  detail,
  config,
  onBookNow,
  onSelectService,
  onSelectStaff,
  formatPrice
}) => {
  const { salon, services, staff, reviews, branches, rating, reviewCount } = detail;
  const isEnabled = (id: string) => config.sections.find((s) => s.id === id)?.enabled ?? true;

  const accentColor = config.accentColor || '#D97706';
  const cardStyle = config.cardStyle || 'rounded-3xl';

  return (
    <div className="space-y-12">
      {/* 1. HERO BANNER */}
      {isEnabled('hero') && (
        <div className="border-b border-stone-800/60 pb-8">
          <SalonHero
            salon={salon}
            config={config}
            onBookNow={onBookNow}
            accentColor={accentColor}
          />
        </div>
      )}

      {/* 2. MAJESTIC GALLERY DISPLAY */}
      {isEnabled('gallery') && (
        <MotionPreset
          fade
          blur
          delay={0.2}
          slide={{ direction: 'down', offset: 30 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          <SalonGalleryCarousel
            coverImage={salon.coverImage}
            gallery={salon.gallery}
            salonName={salon.name}
            cardStyle={cardStyle}
            className="h-[380px] sm:h-[480px] lg:h-[540px]"
          />
        </MotionPreset>
      )}

      {/* 3. ELEGANT 2-COLUMN CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Prestations phares */}
        {isEnabled('featured_services') && (
          <FeaturedServicesCard
            services={services}
            featuredIds={config.featuredServiceIds}
            cardStyle={cardStyle}
            accentColor={accentColor}
            onSelectService={onSelectService}
            formatPrice={formatPrice}
          />
        )}

        {/* Équipe d'artisans */}
        {isEnabled('team') && (
          <SalonTeamShowcase
            staff={staff}
            visibleStaffIds={config.visibleStaffIds}
            cardStyle={cardStyle}
            accentColor={accentColor}
            onSelectStaff={onSelectStaff}
          />
        )}

        {/* Gage de confiance */}
        {isEnabled('trust') && (
          <SalonTrustCard
            rating={rating ?? salon.rating}
            reviewCount={reviewCount ?? salon.reviewCount}
            salonName={salon.name}
            cardStyle={cardStyle}
            accentColor={accentColor}
          />
        )}

        {/* Horaires et accès */}
        {isEnabled('location_hours') && (
          <SalonLocationHoursCard
            address={salon.address}
            city={salon.city}
            commune={salon.commune}
            quarter={salon.quarter}
            phone={salon.phone}
            whatsapp={salon.whatsapp}
            branches={branches}
            cardStyle={cardStyle}
            accentColor={accentColor}
            showPhone={config.showPhone}
            showWhatsapp={config.showWhatsapp}
          />
        )}
      </div>

      {/* 4. AVIS CLIENTS */}
      {isEnabled('reviews') && (
        <MotionPreset fade blur delay={0.3} transition={{ duration: 0.5 }}>
          <SalonReviewsSection
            reviews={reviews}
            rating={rating ?? salon.rating}
            reviewCount={reviewCount ?? salon.reviewCount}
            cardStyle={cardStyle}
            accentColor={accentColor}
          />
        </MotionPreset>
      )}
    </div>
  );
};
