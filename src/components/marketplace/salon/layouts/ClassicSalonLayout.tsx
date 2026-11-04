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

export const ClassicSalonLayout: React.FC<LayoutProps> = ({
  detail,
  config,
  onBookNow,
  onSelectService,
  onSelectStaff,
  formatPrice
}) => {
  const { salon, services, staff, reviews, branches, rating, reviewCount } = detail;
  const isEnabled = (id: string) => config.sections.find((s) => s.id === id)?.enabled ?? true;

  const accentColor = config.accentColor || '#C9A45C';
  const cardStyle = config.cardStyle || 'rounded-3xl';

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* 1. HERO SECTION */}
      {isEnabled('hero') && (
        <SalonHero
          salon={salon}
          config={config}
          onBookNow={onBookNow}
          accentColor={accentColor}
        />
      )}

      {/* 2. MAIN BENTO GRID (Adapted directly from about-us-page-30) */}
      <MotionPreset
        fade
        blur
        delay={0.2}
        slide={{ direction: 'down', offset: 30 }}
        transition={{ duration: 0.5 }}
        className="grid grid-cols-1 gap-6 md:grid-cols-[380px_1fr] lg:grid-cols-[400px_1fr] items-start"
      >
        {/* Left Column: Salon Gallery Carousel */}
        {isEnabled('gallery') && (
          <SalonGalleryCarousel
            coverImage={salon.coverImage}
            gallery={salon.gallery}
            salonName={salon.name}
            cardStyle={cardStyle}
          />
        )}

        {/* Right Column: Interactive business cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Prestations en vedette */}
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

          {/* Gage de confiance (spanning 2 columns) */}
          {isEnabled('trust') && (
            <div className="sm:col-span-2">
              <SalonTrustCard
                rating={rating ?? salon.rating}
                reviewCount={reviewCount ?? salon.reviewCount}
                salonName={salon.name}
                cardStyle={cardStyle}
                accentColor={accentColor}
              />
            </div>
          )}
        </div>
      </MotionPreset>

      {/* 3. HORAIRES & ACCÈS */}
      {isEnabled('location_hours') && (
        <MotionPreset fade blur delay={0.3} transition={{ duration: 0.5 }}>
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
        </MotionPreset>
      )}

      {/* 4. AVIS CLIENTS VÉRIFIÉS */}
      {isEnabled('reviews') && (
        <MotionPreset fade blur delay={0.35} transition={{ duration: 0.5 }}>
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
