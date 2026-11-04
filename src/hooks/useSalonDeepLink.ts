import { useEffect, useRef } from 'react';
import { Salon } from '../types';
import {
  buildSalonBookingPath,
  findSalonByLinkKey,
  readSalonKeyFromPath,
  readSalonKeyFromSearch,
} from '../lib/salonLink';

interface DeepLinkOptions {
  salons: Salon[];
  setSelectedSalonForModal: (salon: Salon | null) => void;
  setMode: (mode: 'marketplace' | 'erp') => void;
  /** Notified when the link points to an unknown salon. */
  onNotFound?: () => void;
}

/**
 * Opens a salon's booking profile when the marketplace is loaded from a public
 * link such as `/salons/le-roi-du-degrade` (a QR code scan).
 * Legacy `/?salon=<slug>` links keep working.
 */
export function useSalonDeepLink({ salons, setSelectedSalonForModal, setMode, onNotFound }: DeepLinkOptions) {
  const onNotFoundRef = useRef(onNotFound);
  onNotFoundRef.current = onNotFound;

  useEffect(() => {
    if (!salons.length) return;

    const openFromUrl = () => {
      const key = readSalonKeyFromPath() ?? readSalonKeyFromSearch();
      if (!key) return;

      const salon = findSalonByLinkKey(salons, key);
      if (!salon) {
        onNotFoundRef.current?.();
        return;
      }

      setMode('marketplace');
      setSelectedSalonForModal(salon);

      // Replace the URL with the canonical public path without reloading.
      const canonicalPath = buildSalonBookingPath(salon);
      if (window.location.pathname + window.location.search !== canonicalPath) {
        window.history.replaceState({}, '', canonicalPath);
      }
    };

    openFromUrl();
    window.addEventListener('popstate', openFromUrl);
    return () => window.removeEventListener('popstate', openFromUrl);
  }, [salons, setMode, setSelectedSalonForModal]);
}
