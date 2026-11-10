import React, { lazy } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Helper typé pour charger paresseusement un export nommé avec React.lazy(),
 * tout en préservant les types exacts des props du composant.
 */
export function lazyNamed<TModule extends Record<string, any>, K extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: K,
): React.LazyExoticComponent<
  TModule[K] extends React.ComponentType<any> ? TModule[K] : React.ComponentType<any>
> {
  return lazy(async () => {
    const mod = await loader();
    return {
      default: mod[exportName] as TModule[K] extends React.ComponentType<any>
        ? TModule[K]
        : React.ComponentType<any>,
    };
  });
}

export const RouteLoadingFallback: React.FC<{ label?: string }> = ({ label = 'Chargement de la page…' }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex-1 min-h-[280px] flex items-center justify-center bg-[#0d0d0e] text-stone-300 px-4 py-16"
  >
    <div className="flex items-center gap-3 rounded-2xl border border-[#222229] bg-[#141418] px-5 py-3 text-sm shadow-lg">
      <Loader2 className="w-4 h-4 animate-spin text-[#C9A45C]" aria-hidden="true" />
      <span>{label}</span>
    </div>
  </div>
);

export const SectionLoadingFallback: React.FC<{ label?: string }> = ({ label = 'Chargement du module…' }) => (
  <div
    role="status"
    aria-live="polite"
    className="flex items-center justify-center rounded-2xl border border-[#1d1d22] bg-[#111114]/70 px-4 py-14 text-stone-400"
  >
    <div className="flex items-center gap-2.5 text-xs font-medium">
      <Loader2 className="w-4 h-4 animate-spin text-[#C9A45C]" aria-hidden="true" />
      <span>{label}</span>
    </div>
  </div>
);
