import assert from 'node:assert/strict';
import test from 'node:test';
import type { Salon } from '../src/types';
import { toSalonProfilePayload } from '../src/features/salon/salonProfileRules';
import { INITIAL_REVIEWS_STATE, toReviewPayload } from '../src/features/reviews/reviewRules';

test('profil : seuls les champs fournis partent, avec les noms de colonnes de la base', () => {
  const payload = toSalonProfilePayload({ name: 'Salon Nord', tagline: 'Coupe nette' } as Partial<Salon>);
  assert.deepEqual(payload, { name: 'Salon Nord', tagline: 'Coupe nette' });
});

test('profil : une chaîne vide efface slug, logo, couverture et e-mail (null)', () => {
  const payload = toSalonProfilePayload({
    slug: '',
    logo: '',
    coverImage: '',
    email: '',
  } as Partial<Salon>);
  assert.deepEqual(payload, { slug: null, logo_url: null, cover_url: null, email: null });
});

test('profil : la galerie détaillée prime sur la galerie simple', () => {
  const payload = toSalonProfilePayload({
    galleryItems: [{ url: 'a.jpg', title: 'Fade', description: 'Dégradé' }],
    gallery: ['ignorée.jpg'],
  } as unknown as Partial<Salon>);
  assert.deepEqual(payload.gallery, [{ url: 'a.jpg', title: 'Fade', description: 'Dégradé' }]);
});

test('profil : galerie simple convertie en entrées sans titre', () => {
  const payload = toSalonProfilePayload({ gallery: ['b.jpg'] } as unknown as Partial<Salon>);
  assert.deepEqual(payload.gallery, [{ url: 'b.jpg', title: '', description: '' }]);
});

test('avis : charge utile limitée à l’auteur, la note et le commentaire', () => {
  const payload = toReviewPayload({
    author: 'Awa',
    rating: 5,
    comment: 'Très bien',
  });
  assert.deepEqual(Object.keys(payload).sort(), ['author', 'comment', 'rating']);
});

test('avis : aucun avis fictif à l’état initial', () => {
  assert.deepEqual(INITIAL_REVIEWS_STATE, []);
});
