import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Scissors, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SalonType, ServiceCategory } from '../../types';

type Page = 'login' | 'signup' | 'onboarding' | 'success';
const input = 'w-full rounded-xl border border-[#303035] bg-[#111113] px-4 py-3 text-sm text-white outline-none focus:border-[#c9a45c] transition-colors placeholder:text-stone-600';
const label = 'block text-xs font-semibold text-stone-300 mb-2';

export function BusinessAccess() {
  const { authStartView, setIsRegisterSalonOpen, createSalon, addService, addStaff, setMode, setUserRole } = useApp();
  const [page, setPage] = useState<Page>(authStartView);
  const [step, setStep] = useState(0);
  const [owner, setOwner] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [salonType, setSalonType] = useState<SalonType>('barbershop');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Abidjan');
  const [commune, setCommune] = useState('');
  const [address, setAddress] = useState('');
  const [service, setService] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('coupe');
  const [duration, setDuration] = useState('30');
  const [open, setOpen] = useState('09:00');
  const [close, setClose] = useState('19:00');
  const [error, setError] = useState('');
  const steps = ['Votre salon', 'Coordonnées', 'Votre activité', 'Récapitulatif'];

  function nextStep(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (step === 0 && !name.trim()) return setError('Renseignez le nom de votre salon.');
    if (step === 1 && (!phone.trim() || !city.trim() || !commune.trim() || !address.trim())) return setError('Complétez les coordonnées du salon.');
    if (step === 2 && (!service.trim() || !Number.isSafeInteger(Number(price)) || Number(price) <= 0 || !Number.isInteger(Number(duration)) || Number(duration) <= 0 || !open || !close || open >= close)) return setError('Vérifiez la prestation, son prix, sa durée et les horaires.');
    setStep(step + 1);
  }

  function finish() {
    const openingHours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].map(day => ({ day, open, close, isOpen: true }));
    openingHours.push({ day: 'Dimanche', open, close, isOpen: false });
    const salon = createSalon({
      name: name.trim(), ownerName: owner.trim(), type: salonType, phone: phone.trim(), whatsapp: phone.trim(), email: email.trim(),
      city: city.trim(), commune: commune.trim(), quarter: '', address: address.trim(), tagline: '', description: '',
      minPrice: Number(price), openingHours, paymentMethods: ['cash'], isPublishedOnMarketplace: false,
      isRecommended: false, isPopular: false, isVerified: false, rating: 0, reviewCount: 0, demoOnboarding: true,
    }, { seedDemoData: false });
    addService({ salonId: salon.id, name: service.trim(), category, description: '', price: Number(price), durationMinutes: Number(duration) });
    addStaff({ salonId: salon.id, name: owner.trim(), role: 'manager', avatar: '', specialties: [], rating: 0, commissionRate: 0, phone: phone.trim(), isAvailable: true });
    setPage('success');
  }

  return <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#0c0c0e] text-[#f7f6f2]" role="dialog" aria-modal="true" aria-label="Espace professionnel">
    <div className="min-h-screen grid lg:grid-cols-[0.85fr_1.15fr]">
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-white/5 bg-[#141311] p-12">
        <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-[#c9a45c]/10 blur-[100px]" />
        <div className="relative flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl border border-[#c9a45c]/30 bg-[#c9a45c]/10 text-[#c9a45c]"><Scissors size={20} /></div><div className="font-bold text-xl">Barber<span className="text-[#c9a45c]">Cuts</span><span className="block text-[10px] uppercase tracking-[.25em] text-stone-500">Business</span></div></div>
        <div className="relative max-w-md"><p className="mb-5 text-xs font-semibold tracking-[.25em] text-[#c9a45c] uppercase">Votre espace professionnel</p><h2 className="font-serif-luxury text-5xl leading-tight">Votre savoir-faire mérite un espace à sa hauteur.</h2><p className="mt-6 leading-relaxed text-stone-400">Un seul endroit pour organiser votre salon, suivre vos rendez-vous et développer votre activité.</p><div className="mt-10 space-y-4 text-sm text-stone-300">{['Un espace pensé pour votre salon', 'Une configuration simple, étape par étape', 'Vos informations réunies au même endroit'].map(t => <div className="flex gap-3 items-center" key={t}><Check size={16} className="text-[#c9a45c]" />{t}</div>)}</div></div>
        <p className="relative text-xs text-stone-600">BARBER CUTS · CONÇU POUR LES PROFESSIONNELS</p>
      </aside>
      <div className="relative flex flex-col items-center px-5 py-8 sm:px-10 lg:py-12">
        <div className="flex w-full max-w-xl items-center justify-between mb-10"><span className="lg:hidden text-lg font-bold">Barber<span className="text-[#c9a45c]">Cuts</span></span><span className="hidden lg:block text-xs uppercase tracking-[.18em] text-stone-500">Bienvenue chez vous</span><button onClick={() => setIsRegisterSalonOpen(false)} aria-label="Fermer" className="rounded-full border border-[#303035] p-2 text-stone-400 hover:text-white"><X size={18} /></button></div>
        <div className="w-full max-w-xl my-auto pb-12">
          {page === 'login' && <div className="space-y-6"><div><p className="text-xs uppercase tracking-[.2em] text-[#c9a45c]">Barber Cuts Business</p><h1 className="mt-3 text-3xl font-bold">Heureux de vous retrouver.</h1><p className="mt-3 text-sm leading-relaxed text-stone-400">La connexion sécurisée sera disponible après le raccordement de l’authentification.</p></div><div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm text-amber-200">Connexion indisponible : aucun compte réel n’est encore connecté à Neon.</div><div><label className={label} htmlFor="login-email">Adresse e-mail</label><input id="login-email" type="email" className={input} placeholder="vous@exemple.com" disabled /></div><div><label className={label} htmlFor="login-password">Mot de passe</label><input id="login-password" type="password" className={input} placeholder="••••••••" disabled /></div><button disabled className="w-full rounded-xl bg-stone-700 px-5 py-3.5 text-sm font-bold text-stone-400">Connexion bientôt disponible</button><p className="text-center text-sm text-stone-400">Nouveau sur Barber Cuts ? <button onClick={() => setPage('signup')} className="font-semibold text-[#c9a45c]">Découvrir l’inscription</button></p></div>}
          {page === 'signup' && <form className="space-y-6" onSubmit={e => { e.preventDefault(); setPage('onboarding'); }}><div><p className="text-xs uppercase tracking-[.2em] text-[#c9a45c]">Une nouvelle aventure</p><h1 className="mt-3 text-3xl font-bold">Créons votre espace.</h1><p className="mt-3 text-sm leading-relaxed text-stone-400">Commençons par quelques informations pour personnaliser votre expérience.</p></div><div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 text-sm leading-relaxed text-amber-200"><strong>Parcours de démonstration.</strong> Aucun compte réel n’est créé. Les données restent dans ce navigateur : n’utilisez pas d’informations sensibles.</div><div><label className={label} htmlFor="owner-name">Votre nom</label><input required id="owner-name" value={owner} onChange={e => setOwner(e.target.value)} className={input} placeholder="Votre nom complet" /></div><div><label className={label} htmlFor="owner-email">Adresse e-mail</label><input required id="owner-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className={input} placeholder="vous@exemple.com" /></div><button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c9a45c] px-5 py-3.5 text-sm font-bold text-[#101010] hover:bg-[#d9b671]">Continuer en démonstration <ArrowRight size={16} /></button><p className="text-center text-sm text-stone-400">Déjà un compte ? <button type="button" onClick={() => setPage('login')} className="font-semibold text-[#c9a45c]">Se connecter</button></p></form>}
          {page === 'onboarding' && <form onSubmit={nextStep} className="space-y-7"><div><div className="flex justify-between text-xs font-semibold text-stone-400"><span className="uppercase tracking-[.16em] text-[#c9a45c]">Configuration de votre salon</span><span>0{step + 1} / 04</span></div><div className="mt-4 h-1.5 rounded-full bg-[#29292d]"><div className="h-full rounded-full bg-[#c9a45c] transition-all" style={{ width: `${(step + 1) * 25}%` }} /></div><p className="mt-5 text-xs text-stone-500">{steps[step]}</p><h1 className="mt-2 text-3xl font-bold">{['Parlons de votre salon.', 'Où vous trouver ?', 'Votre activité, à votre rythme.', 'Tout est prêt ?'][step]}</h1><p className="mt-3 text-sm text-stone-400">{['Les premières informations pour créer votre espace.', 'Ces informations apparaîtront dans votre espace de gestion.', 'Ajoutez une première prestation et vos horaires habituels.', 'Vérifiez vos informations avant de créer votre espace de démonstration.'][step]}</p></div>
            {step === 0 && <div className="space-y-5"><div><label className={label} htmlFor="salon-name">Nom du salon *</label><input id="salon-name" className={input} value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Maison du Barbier" /></div><div><label className={label} htmlFor="salon-type">Type d’établissement</label><select id="salon-type" className={input} value={salonType} onChange={e => setSalonType(e.target.value as SalonType)}><option value="barbershop">Barbershop</option><option value="salon_femme">Salon de coiffure femme</option><option value="salon_mixte">Salon mixte</option><option value="institut">Institut de beauté</option></select></div></div>}
            {step === 1 && <div className="space-y-5"><div><label className={label} htmlFor="salon-phone">Téléphone *</label><input id="salon-phone" className={input} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Numéro du salon" /></div><div className="grid sm:grid-cols-2 gap-4"><div><label className={label} htmlFor="salon-city">Ville *</label><input id="salon-city" className={input} value={city} onChange={e => setCity(e.target.value)} /></div><div><label className={label} htmlFor="salon-commune">Commune *</label><input id="salon-commune" className={input} value={commune} onChange={e => setCommune(e.target.value)} placeholder="Ex. Cocody" /></div></div><div><label className={label} htmlFor="salon-address">Adresse *</label><input id="salon-address" className={input} value={address} onChange={e => setAddress(e.target.value)} placeholder="Adresse ou repère" /></div></div>}
            {step === 2 && <div className="space-y-5"><div><label className={label} htmlFor="service-category">Catégorie</label><select id="service-category" className={input} value={category} onChange={e => setCategory(e.target.value as ServiceCategory)}><option value="coupe">Coupe</option><option value="barbe">Barbe</option><option value="tresses">Tresses</option><option value="soins">Soins</option><option value="coloration">Coloration</option><option value="visage">Visage</option><option value="combo">Formule</option></select></div><div><label className={label} htmlFor="service-name">Première prestation *</label><input id="service-name" className={input} value={service} onChange={e => setService(e.target.value)} placeholder="Ex. Coupe classique" /></div><div className="grid grid-cols-2 gap-4"><div><label className={label} htmlFor="service-price">Prix (FCFA) *</label><input id="service-price" type="number" min="1" step="1" className={input} value={price} onChange={e => setPrice(e.target.value)} placeholder="3000" /></div><div><label className={label} htmlFor="service-duration">Durée (minutes) *</label><input id="service-duration" type="number" min="1" step="1" className={input} value={duration} onChange={e => setDuration(e.target.value)} /></div></div><div className="grid grid-cols-2 gap-4"><div><label className={label} htmlFor="open-time">Ouverture</label><input id="open-time" type="time" className={input} value={open} onChange={e => setOpen(e.target.value)} /></div><div><label className={label} htmlFor="close-time">Fermeture</label><input id="close-time" type="time" className={input} value={close} onChange={e => setClose(e.target.value)} /></div></div><p className="text-xs text-stone-500">Horaires appliqués du lundi au samedi ; dimanche fermé. Vous pourrez les modifier ensuite.</p></div>}
            {step === 3 && <div className="space-y-3 rounded-2xl border border-[#303035] bg-[#171719] p-5 text-sm">{[['Propriétaire', owner], ['Salon', name], ['Adresse', `${address}, ${commune}, ${city}`], ['Téléphone', phone], ['Prestation', `${service} · ${Number(price).toLocaleString('fr-FR')} FCFA · ${duration} min`], ['Horaires', `${open} – ${close}`]].map(([k,v]) => <div key={k} className="flex justify-between gap-5 border-b border-white/5 py-2 last:border-0"><span className="text-stone-500">{k}</span><span className="text-right text-stone-100">{v}</span></div>)}<p className="pt-2 text-xs text-stone-400">Votre salon reste privé et n’est pas publié sur la marketplace.</p></div>}
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
            <div className="flex gap-3">{step > 0 && <button type="button" onClick={() => { setStep(step - 1); setError(''); }} className="rounded-xl border border-[#303035] px-5 py-3 text-sm text-stone-300"><ArrowLeft size={17} /></button>}{step < 3 ? <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#c9a45c] py-3.5 text-sm font-bold text-[#101010]">Continuer <ArrowRight size={16} /></button> : <button type="button" onClick={finish} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#c9a45c] py-3.5 text-sm font-bold text-[#101010]">Valider la configuration <Check size={16} /></button>}</div>
          </form>}
          {page === 'success' && <div className="relative overflow-hidden text-center"><div aria-hidden="true" className="confetti-container">{Array.from({ length: 24 }, (_, i) => <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * .12}s`, backgroundColor: ['#c9a45c', '#f7f6f2', '#8eac97'][i % 3] }} />)}</div><div className="relative mx-auto grid h-20 w-20 place-items-center rounded-full border border-[#c9a45c]/40 bg-[#c9a45c]/10 text-[#c9a45c]"><CheckCircle2 size={40} /></div><p className="mt-7 text-xs uppercase tracking-[.2em] text-[#c9a45c]">Configuration validée</p><h1 className="mt-3 text-3xl font-bold">Bienvenue chez vous, {owner.trim().split(' ')[0]} !</h1><p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-stone-400">Votre espace de démonstration pour <strong className="text-white">{name}</strong> est prêt. Votre vitrine reste privée.</p><button onClick={() => { setUserRole('owner'); setMode('erp'); setIsRegisterSalonOpen(false); }} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#c9a45c] px-7 py-3.5 text-sm font-bold text-[#101010]">Découvrir mon tableau de bord <ArrowRight size={16} /></button><p className="mt-5 flex items-center justify-center gap-2 text-xs text-stone-500"><ShieldCheck size={14} /> Démonstration locale · aucun compte réel créé</p></div>}
          {page !== 'success' && <p className="mt-10 flex items-center gap-2 text-xs text-stone-600"><Sparkles size={14} /> Barber Cuts Business · Parcours de démonstration</p>}
        </div>
      </div>
    </div>
  </div>;
}
