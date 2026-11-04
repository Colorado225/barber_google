import React from 'react';
import { useApp } from '../../context/AppContext';
import { Globe } from 'lucide-react';

export const MarketplaceShowcaseView: React.FC = () => {
  const { activeSalon, services } = useApp();
  const gallery = activeSalon.gallery ?? [];
  const featuredIds = activeSalon.featuredPrestations ?? [];
  const featuredServices = services.filter(
    (service) => service.salonId === activeSalon.id && featuredIds.includes(service.id)
  );

  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3">
        <Globe className="h-6 w-6 text-[#C9A45C]" />
        <div>
          <h1 className="text-xl font-bold text-white">Vitrine marketplace</h1>
          <p className="text-sm text-stone-400">Données enregistrées pour {activeSalon.name}</p>
        </div>
      </header>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[#27272c] bg-[#161619] p-5">
          <dt className="text-xs text-stone-400">Publication</dt>
          <dd className="mt-1 font-semibold text-white">
            {activeSalon.isPublishedOnMarketplace === true ? 'Publié' : 'Non publié'}
          </dd>
        </div>
        <div className="rounded-xl border border-[#27272c] bg-[#161619] p-5">
          <dt className="text-xs text-stone-400">Photos enregistrées</dt>
          <dd className="mt-1 font-semibold text-white">{gallery.length}</dd>
        </div>
      </dl>

      <div className="space-y-3">
        <h2 className="font-semibold text-white">Prestations mises en avant</h2>
        {featuredServices.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {featuredServices.map((service) => (
              <li key={service.id} className="rounded-xl border border-[#27272c] bg-[#161619] p-4">
                <p className="font-medium text-white">{service.name}</p>
                <p className="mt-1 text-xs text-stone-400">{service.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-[#27272c] bg-[#161619] p-4 text-sm text-stone-400">
            Aucune prestation n'est mise en avant.
          </p>
        )}
      </div>

      {gallery.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {gallery.map((image) => (
            <img key={image} src={image} alt="" className="aspect-video w-full rounded-lg object-cover" />
          ))}
        </div>
      )}

      <p className="text-xs text-stone-500">
        La modification de la vitrine est désactivée car aucune API persistante n'est disponible pour
        ces champs.
      </p>
    </section>
  );
};
