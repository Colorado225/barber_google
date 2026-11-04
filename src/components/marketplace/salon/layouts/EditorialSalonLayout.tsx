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

export const EditorialSalonLayout: React.FC<LayoutProps> = ({
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
      {/* 1. EDITORIAL HEADER */}
      {isEnabled('hero') && (
        <div className="border-b border-stone-800 pb-6">
          <SalonHero
            salon={salon}
            config={config}
            onBookNow={onBookNow}
            accentColor={accentColor}
          />
        </div>
      )}

      {/* 2. ASYMMETRICAL EDITORIAL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Gallery takes 2 columns */}
        {isEnabled('gallery') && (
          <div className="lg:col-span-2">
            <SalonGalleryCarousel
              coverImage={salon.coverImage}
              gallery={salon.gallery}
              salonName={salon.name}
              cardStyle={cardStyle}
              className="h-[360px] sm:h-[440px] lg:h-[480px]"
            />
          </div>
        )}

        {/* Featured Service Card occupies the 3rd column */}
        {isEnabled('featured_services') && (
          <div className="h-full">
            <FeaturedServicesCard
              services={services}
              featuredIds={config.featuredServiceIds}
              cardStyle={cardStyle}
              accentColor={accentColor}
              onSelectService={onSelectService}
              formatPrice={formatPrice}
            />
          </div>
        )}
      </div>

      {/* 3. TRIPTYQUE CARDS: TEAM, TRUST, LOCATION */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isEnabled('team') && (
          <SalonTeamShowcase
            staff={staff}
            visibleStaffIds={config.visibleStaffIds}
            cardStyle={cardStyle}
            accentColor={accentColor}
            onSelectStaff={onSelectStaff}
          />
        )}

        {isEnabled('trust') && (
          <SalonTrustCard
            rating={rating ?? salon.rating}
            reviewCount={reviewCount ?? salon.reviewCount}
            salonName={salon.name}
            cardStyle={cardStyle}
            accentColor={accentColor}
          />
        )}

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

      {/* 4. REVIEWS SECTION */}
      {isEnabled('reviews') && (
        <MotionPreset fade blur delay={0.25} transition={{ duration: 0.5 }}>
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
