import express from 'express';
import { z } from 'zod';
import { hashSessionToken } from './password.js';
import { toHttpError } from './salon-repository.js';

const cookieName = 'bc_session';
const uuid = z.string().uuid();

const clientSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(3).max(40),
    email: z.string().trim().email().max(254).or(z.literal('')).optional(),
    segment: z
      .enum(['new', 'active', 'loyal', 'vip', 'inactive', 'to_reactivate'])
      .default('new'),
    favoriteService: z.string().max(120).optional(),
    notes: z.string().max(2000).optional()
  })
  .strict();

const serviceSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    category: z.enum(['coupe', 'barbe', 'tresses', 'soins', 'coloration', 'visage', 'combo']),
    description: z.string().max(1000).optional(),
    price: z.number().int().positive().max(100_000_000),
    durationMinutes: z.number().int().min(5).max(600),
    popular: z.boolean().optional()
  })
  .strict();

const staffSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    role: z.enum(['master_barber', 'barber', 'colorist', 'stylist', 'manager']),
    phone: z.string().max(40).optional(),
    specialties: z.array(z.string().max(60)).max(20).optional(),
    commissionRate: z.number().int().min(0).max(100),
    isAvailable: z.boolean().optional()
  })
  .strict();

const expenseSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    category: z.enum(['rent', 'electricity', 'water', 'salaries', 'products', 'maintenance', 'marketing', 'other']),
    amount: z.number().int().positive().max(1_000_000_000),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    notes: z.string().max(1000).optional()
  })
  .strict();

const stockSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    category: z.enum(['shampoing', 'gel_cire', 'huile_barbe', 'lames', 'soin', 'accessoires']),
    quantity: z.number().int().min(0).max(1_000_000),
    minThreshold: z.number().int().min(0).max(1_000_000),
    unitCost: z.number().int().min(0).max(1_000_000_000),
    supplier: z.string().max(120).optional()
  })
  .strict();

const rewardSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(1000).optional(),
    pointsCost: z.number().int().positive().max(1_000_000),
    category: z.enum(['free_service', 'discount', 'product', 'vip_upgrade']),
    discountPercentage: z.number().int().min(1).max(100).optional(),
    freeServiceName: z.string().max(120).optional(),
    isActive: z.boolean().optional()
  })
  .strict();

const reviewSchema = z
  .object({
    author: z.string().trim().min(1).max(120),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(1000)
  })
  .strict();

function readToken(req) {
  const cookie = (req.headers.cookie || '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${cookieName}=`));
  const token = cookie?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

/**
 * API des ressources d'un salon. Toute requête exige une session valide ; le
 * salonId est vérifié par RLS et par les fonctions SQL, jamais supposé de l'URL.
 */
export function createResourceApp({ authRepository, salonRepository, sessionRunner, allowedOrigin }) {
  if (!allowedOrigin) throw new Error('APP_ORIGIN is required');
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.headers.origin !== allowedOrigin) {
      return res.status(403).json({ error: 'Origine non autorisée.' });
    }
    next();
  });
  app.use(express.json({ limit: '32kb', strict: true }));

  // Sessions : l'identité vient exclusivement du cookie signé côté serveur.
  app.use('/api', async (req, res, next) => {
    try {
      const token = readToken(req);
      const user = token ? await authRepository.getSession(hashSessionToken(token)) : null;
      if (!user) return res.status(401).json({ error: 'Authentification requise.' });
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  });

  const withSalon = (handler) => async (req, res, next) => {
    const parsed = uuid.safeParse(req.params.salonId);
    if (!parsed.success) return res.status(400).json({ error: 'Identifiant de salon invalide.' });
    try {
      const data = await sessionRunner.runAs(req.user.id, () =>
        handler(parsed.data, req)
      );
      if (data === undefined) return res.status(204).end();
      return res.json(data);
    } catch (error) {
      next(error);
    }
  };

  /** Valide le corps ou lève une erreur 400 explicite (champ concerné). */
  function requireBody(schema) {
    return (req) => {
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const err = new Error(
          issue ? `${issue.path.join('.') || 'données'} : ${issue.message}` : 'Données invalides.'
        );
        err.status = 400;
        throw err;
      }
      return parsed.data;
    };
  }

  // ----- Vue agrégée -----
  app.get(
    '/api/salons/:salonId/workspace',
    withSalon((salonId) => salonRepository.workspace(salonId))
  );

  // ----- Clients -----
  app.get('/api/salons/:salonId/clients', withSalon((salonId) => salonRepository.listClients(salonId)));
  app.post(
    '/api/salons/:salonId/clients',
    withSalon((salonId, req) => salonRepository.createClient(salonId, requireBody(clientSchema)(req)))
  );
  app.put(
    '/api/salons/:salonId/clients/:id',
    withSalon((salonId, req) =>
      salonRepository.updateClient(salonId, uuid.parse(req.params.id), requireBody(clientSchema)(req))
    )
  );
  app.delete(
    '/api/salons/:salonId/clients/:id',
    withSalon((salonId, req) => salonRepository.deleteClient(salonId, uuid.parse(req.params.id)))
  );

  // ----- Prestations -----
  app.get('/api/salons/:salonId/services', withSalon((salonId) => salonRepository.listServices(salonId)));
  app.post(
    '/api/salons/:salonId/services',
    withSalon((salonId, req) => salonRepository.saveService(salonId, null, requireBody(serviceSchema)(req)))
  );
  app.put(
    '/api/salons/:salonId/services/:id',
    withSalon((salonId, req) =>
      salonRepository.saveService(salonId, uuid.parse(req.params.id), requireBody(serviceSchema)(req))
    )
  );
  app.delete(
    '/api/salons/:salonId/services/:id',
    withSalon((salonId, req) => salonRepository.deleteService(salonId, uuid.parse(req.params.id)))
  );

  // ----- Équipe -----
  app.get('/api/salons/:salonId/staff', withSalon((salonId) => salonRepository.listStaff(salonId)));
  app.post(
    '/api/salons/:salonId/staff',
    withSalon((salonId, req) => salonRepository.saveStaff(salonId, null, requireBody(staffSchema)(req)))
  );
  app.put(
    '/api/salons/:salonId/staff/:id',
    withSalon((salonId, req) =>
      salonRepository.saveStaff(salonId, uuid.parse(req.params.id), requireBody(staffSchema)(req))
    )
  );
  app.delete(
    '/api/salons/:salonId/staff/:id',
    withSalon((salonId, req) => salonRepository.deleteStaff(salonId, uuid.parse(req.params.id)))
  );

  // ----- Dépenses -----
  app.get('/api/salons/:salonId/expenses', withSalon((salonId) => salonRepository.listExpenses(salonId)));
  app.post(
    '/api/salons/:salonId/expenses',
    withSalon((salonId, req) => salonRepository.addExpense(salonId, requireBody(expenseSchema)(req)))
  );

  // ----- Stocks -----
  app.get('/api/salons/:salonId/stock', withSalon((salonId) => salonRepository.listStock(salonId)));
  app.post(
    '/api/salons/:salonId/stock',
    withSalon((salonId, req) => salonRepository.saveStockItem(salonId, null, requireBody(stockSchema)(req)))
  );
  app.put(
    '/api/salons/:salonId/stock/:id',
    withSalon((salonId, req) =>
      salonRepository.saveStockItem(salonId, uuid.parse(req.params.id), requireBody(stockSchema)(req))
    )
  );
  app.delete(
    '/api/salons/:salonId/stock/:id',
    withSalon((salonId, req) => salonRepository.deleteStockItem(salonId, uuid.parse(req.params.id)))
  );

  // ----- Fidélité -----
  app.get('/api/salons/:salonId/rewards', withSalon((salonId) => salonRepository.listRewards(salonId)));
  app.post(
    '/api/salons/:salonId/rewards',
    withSalon((salonId, req) => salonRepository.saveReward(salonId, null, requireBody(rewardSchema)(req)))
  );
  app.put(
    '/api/salons/:salonId/rewards/:id',
    withSalon((salonId, req) =>
      salonRepository.saveReward(salonId, uuid.parse(req.params.id), requireBody(rewardSchema)(req))
    )
  );
  app.delete(
    '/api/salons/:salonId/rewards/:id',
    withSalon((salonId, req) => salonRepository.deleteReward(salonId, uuid.parse(req.params.id)))
  );

  // ----- Avis -----
  app.get('/api/salons/:salonId/reviews', withSalon((salonId) => salonRepository.listReviews(salonId)));
  app.post(
    '/api/salons/:salonId/reviews',
    withSalon((salonId, req) => salonRepository.addReview(salonId, requireBody(reviewSchema)(req)))
  );
  app.delete(
    '/api/salons/:salonId/reviews/:id',
    withSalon((salonId, req) => salonRepository.deleteReview(salonId, uuid.parse(req.params.id)))
  );

  app.use((error, req, res, next) => {
    const httpError = toHttpError(error);
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse.' });
    if (error instanceof SyntaxError && error.status === 400) {
      return res.status(400).json({ error: 'Requête invalide.' });
    }
    const status = httpError?.status || error.status;
    if (status) return res.status(status).json({ error: httpError?.message || error.message });
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Données invalides.' });
    console.error('Resource request failed:', error?.code || error?.name);
    return res.status(500).json({ error: 'Service temporairement indisponible.' });
  });

  return { app, salonRepository };
}
