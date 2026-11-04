import express from 'express';
import { z } from 'zod';
import { hashSessionToken } from './password.js';
import { toHttpError } from './salon-repository.js';
import { toOperationError } from './operations-repository.js';
import { toFinanceError } from './finance-repository.js';
import { createRateLimiter } from './rate-limit.js';

const cookieName = 'bc_session';
const uuid = z.string().uuid();

const clientSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(3).max(40),
    email: z.string().trim().email().max(254).or(z.literal('')).optional(),
    segment: z.enum(['new', 'active', 'loyal', 'vip', 'inactive', 'to_reactivate']).default('new'),
    favoriteService: z.string().max(120).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

// `serviceSchema` et `staffSchema` ont été remplacés au Lot 3 par
// `serviceFullSchema` / `staffFullSchema` (prestations activables, profil métier).

// `expenseSchema` est remplacé au Lot 4 par `expenseV2Schema` (succursale, justificatif).

const stockSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    category: z.enum(['shampoing', 'gel_cire', 'huile_barbe', 'lames', 'soin', 'accessoires']),
    quantity: z.number().int().min(0).max(1_000_000),
    minThreshold: z.number().int().min(0).max(1_000_000),
    unitCost: z.number().int().min(0).max(1_000_000_000),
    supplier: z.string().max(120).optional(),
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
    isActive: z.boolean().optional(),
  })
  .strict();

const reviewSchema = z
  .object({
    author: z.string().trim().min(1).max(120),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(1).max(1000),
  })
  .strict();

const salonSchema = z
  .object({
    organizationName: z.string().trim().min(1).max(120),
    salonName: z.string().trim().min(1).max(120),
    branchName: z.string().trim().min(1).max(120),
  })
  .strict();

const memberRoleSchema = z
  .object({
    role: z.enum(['owner', 'manager', 'receptionist', 'barber', 'cashier', 'accountant']),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

const memberStatusSchema = z
  .object({ status: z.enum(['active', 'suspended']), reason: z.string().trim().max(500).optional() })
  .strict();

const onboardingSchema = z
  .object({
    step: z.enum(['email_verification', 'salon_creation', 'setup', 'completed']),
    salonCreated: z.boolean().optional(),
  })
  .strict();

// ----- LOT 3 : prestations, personnel, rendez-vous -----
const optionalEmail = z.string().trim().email().max(254).or(z.literal('')).optional();

const serviceFullSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    category: z.enum(['coupe', 'barbe', 'tresses', 'soins', 'coloration', 'visage', 'combo']),
    description: z.string().max(1000).optional(),
    price: z.number().int().positive().max(100_000_000),
    durationMinutes: z.number().int().min(5).max(600),
    prepMinutes: z.number().int().min(0).max(120).optional(),
    popular: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const staffFullSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    role: z.enum(['master_barber', 'barber', 'colorist', 'stylist', 'manager']),
    phone: z.string().max(40).optional(),
    email: optionalEmail,
    specialties: z.array(z.string().max(60)).max(20).optional(),
    commissionRate: z.number().int().min(0).max(100),
    isAvailable: z.boolean().optional(),
    isActive: z.boolean().optional(),
    branchId: z.string().uuid().nullable().optional(),
    serviceIds: z.array(z.string().uuid()).max(200).optional(),
  })
  .strict();

const scheduleSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startsAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    endsAt: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  })
  .strict();

const absenceSchema = z
  .object({
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

/** Horodatage ISO 8601 avec fuseau ; converti en Date pour pg. */
const isoDateTime = z
  .string()
  .min(20)
  .max(40)
  .refine((v) => !Number.isNaN(Date.parse(v)), 'date invalide')
  .transform((v) => new Date(v));

const appointmentSchema = z
  .object({
    branchId: z.string().uuid(),
    clientId: z.string().uuid(),
    // null = « sans préférence » : le serveur choisit un employé compétent et libre.
    staffId: z.string().uuid().nullable(),
    serviceId: z.string().uuid(),
    startsAt: isoDateTime,
    endsAt: isoDateTime,
    notes: z.string().max(2000).optional(),
    source: z.enum(['direct', 'phone', 'whatsapp']).optional(),
  })
  .strict();

const rescheduleSchema = z
  .object({
    staffId: z.string().uuid(),
    serviceId: z.string().uuid(),
    startsAt: isoDateTime,
    endsAt: isoDateTime,
    notes: z.string().max(2000).optional(),
  })
  .strict();

const transitionSchema = z
  .object({
    status: z.enum([
      'pending',
      'confirmed',
      'checked_in',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
    ]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

const cancelSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();

// ----- LOT 4 : finances -----
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const expenseV2Schema = z
  .object({
    title: z.string().trim().min(1).max(120),
    category: z.enum([
      'rent',
      'electricity',
      'water',
      'salaries',
      'products',
      'maintenance',
      'marketing',
      'other',
    ]),
    amount: z.number().int().positive().max(1_000_000_000),
    date: dateOnly,
    notes: z.string().max(1000).optional(),
    branchId: z.string().uuid().nullable().optional(),
    receiptRef: z.string().max(200).optional(),
  })
  .strict();

const cashOpenSchema = z
  .object({
    branchId: z.string().uuid(),
    registerId: z.string().uuid().optional(),
    openingBalance: z.number().int().min(0).max(1_000_000_000),
  })
  .strict();

const cashCloseSchema = z
  .object({
    countedCash: z.number().int().min(0).max(1_000_000_000),
    notes: z.string().max(1000).optional(),
  })
  .strict();

const paymentMethods = ['cash', 'manual_mobile', 'manual_card', 'other'];

const paymentSchema = z
  .object({
    appointmentId: z.string().uuid(),
    amount: z.number().int().positive().max(1_000_000_000),
    method: z.enum(paymentMethods),
    // Un paiement électronique non prouvé reste « pending » ; le client ne décide
    // jamais qu'un encaissement est confirmé.
    paymentStatus: z.enum(['pending', 'confirmed']).optional(),
    providerReference: z.string().max(200).optional(),
    // Clé d'idempotence fournie par le client : un rejeu ne crée pas de doublon.
    idempotencyKey: z.string().uuid(),
  })
  .strict();

const refundSchema = z
  .object({
    appointmentId: z.string().uuid(),
    amount: z.number().int().positive().max(1_000_000_000),
    method: z.enum(paymentMethods),
    reason: z.string().trim().min(3).max(500),
    originalEntryId: z.string().uuid().optional(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();

const providerConfirmSchema = z.object({ providerReference: z.string().trim().min(4).max(200) }).strict();

/** Lit ?from=&to= : les valeurs invalides sont ignorées (pas de 400 silencieux). */
function readRange(req) {
  const from = dateOnly.safeParse(req.query.from);
  const to = dateOnly.safeParse(req.query.to);
  return { from: from.success ? from.data : null, to: to.success ? to.data : null };
}

/** Période obligatoire pour les rapports ; défaut : mois courant… à défaut, 30 jours. */
function requireRange(req) {
  const { from, to } = readRange(req);
  if (from && to) return { from, to };
  const end = new Date();
  const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: from ?? start.toISOString().slice(0, 10), to: to ?? end.toISOString().slice(0, 10) };
}

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
 *
 * LOT 2 : le serveur vérifie explicitement la permission de chaque route avant
 * toute lecture (défense en profondeur, RLS reste la barrière). Refus uniforme
 * 403/404 afin de ne pas révéler l'existence d'un autre tenant.
 */
export function createResourceApp({
  authRepository,
  salonRepository,
  operationsRepository,
  financeRepository,
  sessionRunner,
  allowedOrigin,
}) {
  if (!allowedOrigin) throw new Error('APP_ORIGIN is required');
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  // Refus par défaut : endpoints mutables uniquement depuis l'origine définie côté
  // serveur. Les routes GET (lecture) n'ont pas besoin de l'en-tête Origin, ce qui
  // permet la navigation directe et les clients HTTP ; les écritures sont
  // protégées par l'en-tête Origin + cookie SameSite=Strict.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.origin !== allowedOrigin) {
      return res.status(403).json({ error: 'Origine non autorisée.' });
    }
    next();
  });
  app.use(express.json({ limit: '32kb', strict: true }));
  // Limitation globale des routes métier (anti-abus, par IP).
  app.use(
    ['/api', '/api/'],
    createRateLimiter({ windowMs: 60 * 1000, max: 600, key: (req) => `api:${req.ip}` }),
  );

  // Sessions : l'identité vient exclusivement du cookie de session côté serveur.
  // Monté exactement sur /api pour ne pas re-s'authentifier les routes publiques
  // (`/api` ne doit pas correspondre à `/api/auth/login`).
  app.use(['/api', '/api/'], async (req, res, next) => {
    try {
      const token = readToken(req);
      const user = token ? await authRepository.getSession(hashSessionToken(token), { touch: false }) : null;
      if (!user) return res.status(401).json({ error: 'Authentification requise.' });
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  });

  /**
   * Exécute le handler dans la transaction RLS de l'utilisateur connecté.
   * `permission` est contrôlée via la fonction SQL (jamais via le frontend).
   */
  const withSalon = (permission, handler) => async (req, res, next) => {
    const parsed = uuid.safeParse(req.params.salonId);
    if (!parsed.success) return res.status(400).json({ error: 'Identifiant de salon invalide.' });
    try {
      const data = await sessionRunner.runAs(req.user.id, async (tx) => {
        if (permission) {
          const allowed = await tx.query('select barber_private.has_salon_permission($1, $2) as ok', [
            parsed.data,
            permission,
          ]);
          if (!allowed.rows[0]?.ok) {
            const err = new Error('Action non autorisée pour ce salon.');
            err.code = '42501';
            throw err;
          }
        }
        return handler(parsed.data, req, salonRepository.withRunner(tx), tx);
      });
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
          issue ? `${issue.path.join('.') || 'données'} : ${issue.message}` : 'Données invalides.',
        );
        err.status = 400;
        throw err;
      }
      return parsed.data;
    };
  }

  // ----- Contexte de session : memberships, permissions, onboarding -----
  app.get('/api/me', async (req, res, next) => {
    try {
      // Onboarding : lu avant la transaction métier (service d'authentification).
      const storedOnboarding = await authRepository.getOnboarding(req.user.id);
      const data = await sessionRunner.runAs(req.user.id, async (tx) => {
        const memberships = await tx.query(
          `select m.id, m.salon_id as "salonId", m.role, m.status, s.name as "salonName",
                  o.id as "organizationId", o.name as "organizationName", b.id as "branchId", b.name as "branchName"
             from public.bc_memberships m
             join public.bc_salons s on s.id = m.salon_id
             join public.bc_organizations o on o.id = s.organization_id
             left join public.bc_branches b on b.salon_id = s.id
            where m.user_id = (select barber_private.current_user_id()) and m.status = 'active'
            order by s.name`,
        );
        const permissions = await tx.query(
          `select barber_private.salon_permissions(m.salon_id) as permissions
             from public.bc_memberships m
            where m.user_id = (select barber_private.current_user_id()) and m.status = 'active'`,
        );
        const bySalon = Object.fromEntries(
          memberships.rows.map((m, i) => [m.salonId, permissions.rows[i]?.permissions || []]),
        );
        const onboarding = storedOnboarding
          ? {
              currentStep: storedOnboarding.currentStep,
              emailVerified: storedOnboarding.emailVerified || Boolean(req.user.emailVerifiedAt),
              salonCreated: storedOnboarding.salonCreated,
              setupCompleted: storedOnboarding.setupCompleted ?? null,
            }
          : {
              currentStep: 'email_verification',
              emailVerified: Boolean(req.user.emailVerifiedAt),
              salonCreated: false,
              setupCompleted: false,
            };
        return {
          user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name,
            emailVerified: Boolean(req.user.emailVerifiedAt),
          },
          memberships: memberships.rows.map((m) => ({ ...m, permissions: bySalon[m.salonId] || [] })),
          onboarding,
        };
      });
      return res.json(data);
    } catch (error) {
      next(error);
    }
  });

  // ----- Onboarding -----
  app.post('/api/onboarding/progress', async (req, res, next) => {
    const body = requireBody(onboardingSchema)(req);
    try {
      await sessionRunner.runAs(req.user.id, (tx) =>
        tx.query('select public.bc_onboarding_progress($1, $2)', [body.step, body.salonCreated ?? false]),
      );
      return res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/salons', async (req, res, next) => {
    const body = requireBody(salonSchema)(req);
    try {
      const created = await sessionRunner.runAs(req.user.id, (tx) =>
        tx.query('select * from public.bc_create_salon($1, $2, $3)', [
          body.organizationName,
          body.salonName,
          body.branchName,
        ]),
      );
      return res.status(201).json(created.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  // ----- Vue agrégée -----
  app.get(
    '/api/salons/:salonId/workspace',
    withSalon('salon.read', (salonId, _req, repo) => repo.workspace(salonId)),
  );

  // ----- Membres et rôles (Lot 2) -----
  app.get(
    '/api/salons/:salonId/members',
    withSalon('members.read', async (salonId, _req, _repo, tx) => {
      const r = await tx.query('select * from public.bc_list_salon_members($1)', [salonId]);
      return r.rows.map((m) => ({
        id: m.membership_id,
        userId: m.user_id,
        role: m.role,
        status: m.status,
        email: m.email,
        name: m.display_name,
        createdAt: m.created_at,
      }));
    }),
  );
  app.put(
    '/api/salons/:salonId/members/:id/role',
    withSalon('members.manage', async (salonId, req, _repo, tx) => {
      const body = requireBody(memberRoleSchema)(req);
      await tx.query('select public.bc_set_member_role($1,$2,$3,$4)', [
        salonId,
        uuid.parse(req.params.id),
        body.role,
        body.reason ?? '',
      ]);
      return { ok: true };
    }),
  );
  app.put(
    '/api/salons/:salonId/members/:id/status',
    withSalon('members.manage', async (salonId, req, _repo, tx) => {
      const body = requireBody(memberStatusSchema)(req);
      await tx.query('select public.bc_set_member_status($1,$2,$3,$4)', [
        salonId,
        uuid.parse(req.params.id),
        body.status,
        body.reason ?? '',
      ]);
      return { ok: true };
    }),
  );

  // ----- Clients -----
  app.get(
    '/api/salons/:salonId/clients',
    withSalon('clients.read', (salonId, _req, repo) => repo.listClients(salonId)),
  );
  app.post(
    '/api/salons/:salonId/clients',
    withSalon('clients.write', (salonId, req, repo) =>
      repo.createClient(salonId, requireBody(clientSchema)(req)),
    ),
  );
  app.put(
    '/api/salons/:salonId/clients/:id',
    withSalon('clients.write', (salonId, req, repo) =>
      repo.updateClient(salonId, uuid.parse(req.params.id), requireBody(clientSchema)(req)),
    ),
  );
  app.delete(
    '/api/salons/:salonId/clients/:id',
    withSalon('clients.write', (salonId, req, repo) => repo.deleteClient(salonId, uuid.parse(req.params.id))),
  );

  // ----- Prestations (Lot 3 : catalogue activable) -----
  app.get(
    '/api/salons/:salonId/services',
    withSalon('salon.read', (salonId, req, _repo, tx) =>
      operationsRepository.withRunner(tx).listServices(salonId, req.query.all === '1'),
    ),
  );
  app.post(
    '/api/salons/:salonId/services',
    withSalon('catalog.write', (salonId, req, _repo, tx) =>
      operationsRepository.withRunner(tx).saveService(salonId, null, requireBody(serviceFullSchema)(req)),
    ),
  );
  app.put(
    '/api/salons/:salonId/services/:id',
    withSalon('catalog.write', (salonId, req, _repo, tx) =>
      operationsRepository
        .withRunner(tx)
        .saveService(salonId, uuid.parse(req.params.id), requireBody(serviceFullSchema)(req)),
    ),
  );
  app.put(
    '/api/salons/:salonId/services/:id/activation',
    withSalon('catalog.write', (salonId, req, _repo, tx) => {
      const body = requireBody(z.object({ isActive: z.boolean() }).strict())(req);
      return operationsRepository
        .withRunner(tx)
        .setServiceActive(salonId, uuid.parse(req.params.id), body.isActive);
    }),
  );
  app.delete(
    '/api/salons/:salonId/services/:id',
    withSalon('catalog.write', (salonId, req, _repo, tx) =>
      operationsRepository.withRunner(tx).deleteService(salonId, uuid.parse(req.params.id)),
    ),
  );

  // ----- Horaires d'ouverture par succursale (Lot 3) -----
  app.get(
    '/api/salons/:salonId/branches',
    withSalon('salon.read', (salonId, _req, _repo, tx) =>
      operationsRepository.withRunner(tx).listBranches(salonId),
    ),
  );
  app.get(
    '/api/salons/:salonId/branches/:branchId/hours',
    withSalon('salon.read', (salonId, req, _repo, tx) =>
      operationsRepository.withRunner(tx).getBranchHours(salonId, req.params.branchId),
    ),
  );
  app.put(
    '/api/salons/:salonId/branches/:branchId/hours',
    withSalon('branch.update', (salonId, req, _repo, tx) => {
      const body = requireBody(
        z.object({
          hours: z.array(
            z.object({
              weekday: z.number().int().min(0).max(6),
              opensAt: z.string().optional(),
              closesAt: z.string().optional(),
              isOpen: z.boolean().optional(),
            }),
          ),
        }),
      )(req);
      return Promise.all(
        body.hours.map((h) =>
          operationsRepository
            .withRunner(tx)
            .saveBranchHours(salonId, req.params.branchId, h.weekday, h.opensAt, h.closesAt, h.isOpen),
        ),
      );
    }),
  );

  // ----- Équipe (Lot 3 : profil métier, horaires, absences) -----
  app.get(
    '/api/salons/:salonId/staff',
    withSalon('salon.read', (salonId, _req, _repo, tx) =>
      operationsRepository.withRunner(tx).listStaff(salonId),
    ),
  );
  app.post(
    '/api/salons/:salonId/staff',
    withSalon('team.write', (salonId, req, _repo, tx) =>
      operationsRepository.withRunner(tx).saveStaff(salonId, null, requireBody(staffFullSchema)(req)),
    ),
  );
  app.put(
    '/api/salons/:salonId/staff/:id',
    withSalon('team.write', (salonId, req, _repo, tx) =>
      operationsRepository
        .withRunner(tx)
        .saveStaff(salonId, uuid.parse(req.params.id), requireBody(staffFullSchema)(req)),
    ),
  );
  app.delete(
    '/api/salons/:salonId/staff/:id',
    withSalon('team.write', (salonId, req, _repo, tx) =>
      operationsRepository.withRunner(tx).deleteStaff(salonId, uuid.parse(req.params.id)),
    ),
  );

  app.get(
    '/api/salons/:salonId/staff/:id/schedule',
    withSalon('staff.read', (salonId, req, _repo, tx) =>
      operationsRepository.withRunner(tx).listSchedules(salonId, uuid.parse(req.params.id)),
    ),
  );
  app.post(
    '/api/salons/:salonId/staff/:id/schedule',
    withSalon('team.write', (salonId, req, _repo, tx) =>
      operationsRepository
        .withRunner(tx)
        .saveSchedule(salonId, uuid.parse(req.params.id), requireBody(scheduleSchema)(req)),
    ),
  );
  app.delete(
    '/api/salons/:salonId/schedules/:scheduleId',
    withSalon('team.write', (salonId, req, _repo, tx) =>
      operationsRepository.withRunner(tx).deleteSchedule(salonId, uuid.parse(req.params.scheduleId)),
    ),
  );
  app.get(
    '/api/salons/:salonId/staff/:id/absences',
    withSalon('staff.read', (salonId, req, _repo, tx) =>
      operationsRepository.withRunner(tx).listAbsences(salonId, uuid.parse(req.params.id)),
    ),
  );
  app.post(
    '/api/salons/:salonId/staff/:id/absences',
    withSalon('team.write', (salonId, req, _repo, tx) =>
      operationsRepository
        .withRunner(tx)
        .addAbsence(salonId, uuid.parse(req.params.id), requireBody(absenceSchema)(req)),
    ),
  );
  app.delete(
    '/api/salons/:salonId/absences/:absenceId',
    withSalon('team.write', (salonId, req, _repo, tx) =>
      operationsRepository.withRunner(tx).deleteAbsence(salonId, uuid.parse(req.params.absenceId)),
    ),
  );

  // ----- Rendez-vous (Lot 3 : source de vérité du calendrier) -----
  app.get(
    '/api/salons/:salonId/appointments',
    withSalon('appointments.read', (salonId, req, _repo, tx) => {
      const from = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .safeParse(req.query.from);
      const to = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .safeParse(req.query.to);
      const staffId = uuid.optional().safeParse(req.query.staffId);
      return operationsRepository.withRunner(tx).listAppointments(salonId, {
        from: from.success ? from.data : null,
        to: to.success ? to.data : null,
        staffId: staffId.success ? staffId.data : null,
      });
    }),
  );
  app.post(
    '/api/salons/:salonId/appointments',
    withSalon('appointments.write', (salonId, req, _repo, tx) =>
      operationsRepository.withRunner(tx).bookAppointment(salonId, requireBody(appointmentSchema)(req)),
    ),
  );
  app.put(
    '/api/salons/:salonId/appointments/:id',
    withSalon('appointments.write', (salonId, req, _repo, tx) =>
      operationsRepository
        .withRunner(tx)
        .rescheduleAppointment(salonId, uuid.parse(req.params.id), requireBody(rescheduleSchema)(req)),
    ),
  );
  app.post(
    '/api/salons/:salonId/appointments/:id/transition',
    withSalon('appointments.write', (salonId, req, _repo, tx) => {
      const body = requireBody(transitionSchema)(req);
      return operationsRepository
        .withRunner(tx)
        .transitionAppointment(salonId, uuid.parse(req.params.id), body.status, body.reason ?? null);
    }),
  );
  app.post(
    '/api/salons/:salonId/appointments/:id/cancel',
    withSalon('appointments.write', (salonId, req, _repo, tx) => {
      const body = requireBody(cancelSchema)(req);
      return operationsRepository
        .withRunner(tx)
        .cancelAppointment(salonId, uuid.parse(req.params.id), body.reason);
    }),
  );
  app.get(
    '/api/salons/:salonId/appointments/:id/events',
    withSalon('appointments.read', (salonId, req, _repo, tx) =>
      operationsRepository.withRunner(tx).listEvents(salonId, uuid.parse(req.params.id)),
    ),
  );
  app.get(
    '/api/salons/:salonId/availability',
    withSalon('appointments.read', (salonId, req, _repo, tx) => {
      const date = z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .safeParse(req.query.date);
      if (!date.success) {
        const err = new Error('date : date requise (AAAA-MM-JJ).');
        err.status = 400;
        throw err;
      }
      return operationsRepository.withRunner(tx).dayAvailability(salonId, date.data);
    }),
  );

  // ----- Dépenses (Lot 4 : succursale, justificatif, responsable) -----
  app.get(
    '/api/salons/:salonId/expenses',
    withSalon('expenses.read', (salonId, req, _repo, tx) => {
      const range = readRange(req);
      return financeRepository.withRunner(tx).listExpenses(salonId, range);
    }),
  );
  app.post(
    '/api/salons/:salonId/expenses',
    withSalon('expenses.manage', (salonId, req, _repo, tx) =>
      financeRepository.withRunner(tx).addExpense(salonId, requireBody(expenseV2Schema)(req)),
    ),
  );

  // ----- Caisse (Lot 4) -----
  app.get(
    '/api/salons/:salonId/cash-registers',
    withSalon('cash.open', (salonId, req, _repo, tx) => {
      const branch = uuid.safeParse(req.query.branchId);
      if (branch.success)
        return financeRepository
          .withRunner(tx)
          .ensureDefaultRegister(salonId, branch.data)
          .then((r) => [r]);
      return financeRepository.withRunner(tx).listRegisters(salonId);
    }),
  );
  app.get(
    '/api/salons/:salonId/cash-sessions',
    withSalon('cash.open', (salonId, _req, _repo, tx) =>
      financeRepository.withRunner(tx).listSessions(salonId),
    ),
  );
  app.get(
    '/api/salons/:salonId/cash-sessions/current',
    withSalon('cash.open', (salonId, req, _repo, tx) => {
      const branch = uuid.safeParse(req.query.branchId);
      return financeRepository.withRunner(tx).currentSession(salonId, branch.success ? branch.data : null);
    }),
  );
  app.post(
    '/api/salons/:salonId/cash-sessions',
    withSalon('cash.open', (salonId, req, _repo, tx) =>
      financeRepository.withRunner(tx).openSession(salonId, requireBody(cashOpenSchema)(req)),
    ),
  );
  app.post(
    '/api/salons/:salonId/cash-sessions/:id/close',
    withSalon('cash.close', (salonId, req, _repo, tx) =>
      financeRepository
        .withRunner(tx)
        .closeSession(salonId, uuid.parse(req.params.id), requireBody(cashCloseSchema)(req)),
    ),
  );
  app.post(
    '/api/salons/:salonId/cash-sessions/:id/reconcile',
    withSalon('salon.update', (salonId, req, _repo, tx) =>
      financeRepository.withRunner(tx).reconcileSession(salonId, uuid.parse(req.params.id), req.body?.notes),
    ),
  );

  // ----- Encaissements et remboursements (journal immuable) -----
  app.get(
    '/api/salons/:salonId/payments',
    withSalon('payments.read', (salonId, req, _repo, tx) => {
      const range = readRange(req);
      const appointmentId = uuid.safeParse(req.query.appointmentId);
      const sessionId = uuid.safeParse(req.query.sessionId);
      return financeRepository.withRunner(tx).listEntries(salonId, {
        ...range,
        appointmentId: appointmentId.success ? appointmentId.data : null,
        sessionId: sessionId.success ? sessionId.data : null,
      });
    }),
  );
  app.post(
    '/api/salons/:salonId/payments',
    withSalon('finance.write', (salonId, req, _repo, tx) =>
      financeRepository.withRunner(tx).createEntry(salonId, requireBody(paymentSchema)(req)),
    ),
  );
  app.post(
    '/api/salons/:salonId/payments/:id/confirm',
    withSalon('payments.refund', (salonId, req, _repo, tx) => {
      const body = requireBody(providerConfirmSchema)(req);
      return financeRepository
        .withRunner(tx)
        .confirmEntry(salonId, uuid.parse(req.params.id), body.providerReference);
    }),
  );
  app.post(
    '/api/salons/:salonId/refunds',
    withSalon('payments.refund', (salonId, req, _repo, tx) =>
      financeRepository.withRunner(tx).createEntry(salonId, {
        ...requireBody(refundSchema)(req),
        kind: 'refund',
      }),
    ),
  );
  app.get(
    '/api/salons/:salonId/appointments/:id/balance',
    withSalon('payments.read', (salonId, req, _repo, tx) =>
      financeRepository.withRunner(tx).appointmentBalance(salonId, uuid.parse(req.params.id)),
    ),
  );

  // ----- Rapports financiers (calculés, jamais saisis) -----
  app.get(
    '/api/salons/:salonId/finance/summary',
    withSalon('payments.read', (salonId, req, _repo, tx) => {
      const { from, to } = requireRange(req);
      return financeRepository.withRunner(tx).summary(salonId, from, to);
    }),
  );
  app.get(
    '/api/salons/:salonId/finance/report',
    withSalon('reports.read', async (salonId, req, _repo, tx) => {
      const { from, to } = requireRange(req);
      const repo = financeRepository.withRunner(tx);
      const [summary, methods, services, staff, daily] = await Promise.all([
        repo.summary(salonId, from, to),
        repo.byPaymentMethod(salonId, from, to),
        repo.topServices(salonId, from, to),
        repo.staffPerformance(salonId, from, to),
        repo.dailySeries(salonId, from, to),
      ]);
      return { from, to, summary, methods, services, staff, daily };
    }),
  );

  // ----- Stocks -----
  app.get(
    '/api/salons/:salonId/stock',
    withSalon('salon.read', (salonId, _req, repo) => repo.listStock(salonId)),
  );
  app.post(
    '/api/salons/:salonId/stock',
    withSalon('stock.write', (salonId, req, repo) =>
      repo.saveStockItem(salonId, null, requireBody(stockSchema)(req)),
    ),
  );
  app.put(
    '/api/salons/:salonId/stock/:id',
    withSalon('stock.write', (salonId, req, repo) =>
      repo.saveStockItem(salonId, uuid.parse(req.params.id), requireBody(stockSchema)(req)),
    ),
  );
  app.delete(
    '/api/salons/:salonId/stock/:id',
    withSalon('stock.write', (salonId, req, repo) =>
      repo.deleteStockItem(salonId, uuid.parse(req.params.id)),
    ),
  );

  // ----- Fidélité -----
  app.get(
    '/api/salons/:salonId/rewards',
    withSalon('salon.read', (salonId, _req, repo) => repo.listRewards(salonId)),
  );
  app.post(
    '/api/salons/:salonId/rewards',
    withSalon('loyalty.write', (salonId, req, repo) =>
      repo.saveReward(salonId, null, requireBody(rewardSchema)(req)),
    ),
  );
  app.put(
    '/api/salons/:salonId/rewards/:id',
    withSalon('loyalty.write', (salonId, req, repo) =>
      repo.saveReward(salonId, uuid.parse(req.params.id), requireBody(rewardSchema)(req)),
    ),
  );
  app.delete(
    '/api/salons/:salonId/rewards/:id',
    withSalon('loyalty.write', (salonId, req, repo) => repo.deleteReward(salonId, uuid.parse(req.params.id))),
  );

  // ----- Avis -----
  app.get(
    '/api/salons/:salonId/reviews',
    withSalon('salon.read', (salonId, _req, repo) => repo.listReviews(salonId)),
  );
  app.post(
    '/api/salons/:salonId/reviews',
    withSalon('clients.write', (salonId, req, repo) =>
      repo.addReview(salonId, requireBody(reviewSchema)(req)),
    ),
  );
  app.delete(
    '/api/salons/:salonId/reviews/:id',
    withSalon('clients.write', (salonId, req, repo) => repo.deleteReview(salonId, uuid.parse(req.params.id))),
  );

  // Les routes d'administration SaaS ne sont pas exposées tant que le rôle global
  // de plateforme et son périmètre audité ne sont pas définis (cf. docs/MISEAJOUR.md 2.3).
  // Un propriétaire de salon n'y a jamais accès par défaut.
  app.use('/api/admin', (_req, res) => res.status(403).json({ error: 'Action non autorisée.' }));

  // Middleware d'erreur Express : la signature à 4 arguments est obligatoire.
  app.use((error, _req, res, _next) => {
    // Lot 4 : idempotence et immuabilité des écritures financières.
    const financeError = toFinanceError(error);
    if (financeError?.status === 409 || financeError?.status === 403) {
      return res.status(financeError.status).json({ error: financeError.message });
    }
    // Lot 3 : créneau déjà réservé (contrainte d'exclusion ou vérification SQL).
    const operationError = toOperationError(error);
    if (operationError?.status === 409) {
      return res.status(409).json({ error: operationError.message, code: 'slot_conflict' });
    }
    const httpError = toHttpError(error);
    if (error?.type === 'entity.too.large')
      return res.status(413).json({ error: 'Requête trop volumineuse.' });
    if (error instanceof SyntaxError && error.status === 400) {
      return res.status(400).json({ error: 'Requête invalide.' });
    }
    const status = httpError?.status || error.status;
    if (status) return res.status(status).json({ error: httpError?.message || error.message });
    if (error?.name === 'ZodError') return res.status(400).json({ error: 'Données invalides.' });
    if (error?.code === '28000') return res.status(401).json({ error: 'Authentification requise.' });
    console.error('Resource request failed:', error?.code || error?.name);
    return res.status(500).json({ error: 'Service temporairement indisponible.' });
  });

  return { app, salonRepository, operationsRepository, financeRepository };
}
