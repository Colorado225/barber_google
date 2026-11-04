import React from 'react';
import {
  PublicSalonDetail,
  SalonMarketplaceSectionId,
  SalonMarketplaceViewConfig,
  Service,
} from '../../../types';
import { getOrderedEnabledSections, resolveGalleryImages } from '../../../lib/marketplace-customizer';
import { SalonHero } from './SalonHero';
import { SalonGalleryCarousel } from './SalonGalleryCarousel';
import { FeaturedServicesCard } from './FeaturedServicesCard';
import { SalonTeamShowcase } from './SalonTeamShowcase';
import { SalonTrustCard } from './SalonTrustCard';
import { SalonLocationHoursCard } from './SalonLocationHoursCard';
import { SalonReviewsSection } from './SalonReviewsSection';
import { MotionPreset } from '../../ui/motion-preset';

/**
 * Moteur de rendu des sections de la vitrine publique.
 *
 * Respecte l'ordre (`position`) et l'activation (`enabled`) choisis par le
 * propriétaire dans l'éditeur ERP, tout en préservant l'identité visuelle de
 * chaque modèle :
 * - les sections « cartes » consécutives sont regroupées dans une grille ;
 * - en mode bento (Classique), la galerie immédiatement suivie d'un groupe de
 *   cartes s'affiche en colonne latérale, comme le bloc about-us-page-30 ;
 * - les autres sections occupent toute la largeur, dans l'ordre configuré.
 */
export interface SalonOrderedSectionsProps {
  detail: PublicSalonDetail;
  config: SalonMarketplaceViewConfig;
  onBookNow?: () => void;
  onSelectService?: (service: Service) => void;
  onSelectStaff?: (staffId: string) => void;
  formatPrice?: (amount: number) => string;
  /** Sections regroupées en grille lorsqu'elles se suivent. */
  cardSectionIds: SalonMarketplaceSectionId[];
  cardGridClassName: string;
  galleryClassName?: string;
  /** Classe appliquée à la galerie lorsqu'elle fait partie d'un groupe (Éditorial). */
  galleryInGroupClassName?: string;
  trustInGroupClassName?: string;
  heroWrapperClassName?: string;
  /** Classique : galerie + groupe suivant affichés côte à côte. */
  bentoGallery?: boolean;
}

type Block =
  { kind: 'single'; id: SalonMarketplaceSectionId } | { kind: 'group'; ids: SalonMarketplaceSectionId[] };

export const SalonOrderedSections: React.FC<SalonOrderedSectionsProps> = ({
  detail,
  config,
  onBookNow,
  onSelectService,
  onSelectStaff,
  formatPrice,
  cardSectionIds,
  cardGridClassName,
  galleryClassName,
  galleryInGroupClassName,
  trustInGroupClassName,
  heroWrapperClassName,
  bentoGallery = false,
}) => {
  const { salon, services, staff, reviews, branches, rating, reviewCount } = detail;
  const accentColor = config.accentColor || '#C9A45C';
  const cardStyle = config.cardStyle || 'rounded-3xl';
  const galleryImages = resolveGalleryImages(salon, config);

  const renderSection = (id: SalonMarketplaceSectionId, inGroup: boolean): React.ReactNode => {
    switch (id) {
      case 'hero': {
        const hero = (
          <SalonHero salon={salon} config={config} onBookNow={onBookNow} accentColor={accentColor} />
        );
        return heroWrapperClassName ? <div className={heroWrapperClassName}>{hero}</div> : hero;
      }
      case 'gallery': {
        const carousel = (
          <SalonGalleryCarousel
            images={galleryImages}
            salonName={salon.name}
            cardStyle={cardStyle}
            className={galleryClassName}
          />
        );
        return inGroup && galleryInGroupClassName ? (
          <div className={galleryInGroupClassName}>{carousel}</div>
        ) : (
          carousel
        );
      }
      case 'featured_services':
        return (
          <FeaturedServicesCard
            services={services}
            featuredIds={config.featuredServiceIds}
            cardStyle={cardStyle}
            accentColor={accentColor}
            onSelectService={onSelectService}
            formatPrice={formatPrice}
          />
        );
      case 'team':
        return (
          <SalonTeamShowcase
            staff={staff}
            visibleStaffIds={config.visibleStaffIds}
            cardStyle={cardStyle}
            accentColor={accentColor}
            onSelectStaff={onSelectStaff}
          />
        );
      case 'trust': {
        const card = (
          <SalonTrustCard
            rating={rating ?? salon.rating}
            reviewCount={reviewCount ?? salon.reviewCount}
            salonName={salon.name}
            cardStyle={cardStyle}
            accentColor={accentColor}
          />
        );
        return inGroup && trustInGroupClassName ? <div className={trustInGroupClassName}>{card}</div> : card;
      }
      case 'location_hours':
        return (
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
            showAddress={config.showAddress}
            showPhone={config.showPhone}
            showWhatsapp={config.showWhatsapp}
            defaultBranchId={config.featuredBranchId}
          />
        );
      case 'reviews':
        return (
          <SalonReviewsSection
            reviews={reviews}
            rating={rating ?? salon.rating}
            reviewCount={reviewCount ?? salon.reviewCount}
            cardStyle={cardStyle}
            accentColor={accentColor}
          />
        );
      default:
        return null;
    }
  };

  // Construction des blocs : les cartes consécutives forment un groupe.
  const blocks: Block[] = [];
  for (const section of getOrderedEnabledSections(config)) {
    if (cardSectionIds.includes(section.id)) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'group') last.ids.push(section.id);
      else blocks.push({ kind: 'group', ids: [section.id] });
    } else {
      blocks.push({ kind: 'single', id: section.id });
    }
  }

  const renderGroup = (ids: SalonMarketplaceSectionId[], key: string) => (
    <div key={key} className={cardGridClassName}>
      {ids.map((id) => (
        <React.Fragment key={id}>{renderSection(id, true)}</React.Fragment>
      ))}
    </div>
  );

  const rendered: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    // Bento Classique : galerie suivie d'un groupe de cartes → deux colonnes.
    if (
      bentoGallery &&
      block.kind === 'single' &&
      block.id === 'gallery' &&
      blocks[i + 1]?.kind === 'group'
    ) {
      const group = blocks[i + 1] as Extract<Block, { kind: 'group' }>;
      rendered.push(
        <MotionPreset
          key={`bento-${i}`}
          fade
          blur
          delay={0.2}
          slide={{ direction: 'down', offset: 30 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 gap-6 md:grid-cols-[380px_1fr] lg:grid-cols-[400px_1fr] items-start"
        >
          {renderSection('gallery', false)}
          {renderGroup(group.ids, `bento-group-${i}`)}
        </MotionPreset>,
      );
      i++; // le groupe est consommé
      continue;
    }
    if (block.kind === 'group') {
      rendered.push(renderGroup(block.ids, `group-${i}`));
    } else if (block.id === 'gallery') {
      rendered.push(
        <MotionPreset
          key={`single-${block.id}`}
          fade
          blur
          delay={0.2}
          slide={{ direction: 'down', offset: 30 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          {renderSection(block.id, false)}
        </MotionPreset>,
      );
    } else if (block.id === 'location_hours' || block.id === 'reviews') {
      rendered.push(
        <MotionPreset key={`single-${block.id}`} fade blur delay={0.3} transition={{ duration: 0.5 }}>
          {renderSection(block.id, false)}
        </MotionPreset>,
      );
    } else {
      rendered.push(
        <React.Fragment key={`single-${block.id}`}>{renderSection(block.id, false)}</React.Fragment>,
      );
    }
  }

  return <>{rendered}</>;
};
