// Accès aux ressources métier d'un salon. Toutes les écritures passent par les
// fonctions SECURITY DEFINER de la migration 20261103020000 : le serveur ne
// construit jamais de SQL à partir de l'entrée utilisateur.
//
// `queryable` accepte un pg.Pool (production/dev) comme une instance PGlite
// (tests) : les deux exposent `query(text, params)` et `exec(sql)`.

export class PermissionError extends Error {
  constructor(message = 'Action non autorisée pour ce salon.') {
    super(message);
    this.code = '42501';
    this.status = 403;
  }
}

export class ValidationError extends Error {
  constructor(message = 'Données invalides.') {
    super(message);
    this.code = '22023';
    this.status = 400;
  }
}

export class NotFoundError extends Error {
  constructor(message = 'Élément introuvable.') {
    super(message);
    this.code = '42501';
    this.status = 404;
  }
}

/** Convertit une erreur PostgreSQL en erreur HTTP explicite. */
export function toHttpError(error) {
  if (error instanceof PermissionError || error instanceof ValidationError || error instanceof NotFoundError) {
    return error;
  }
  switch (error?.code) {
    case '42501':
      return new PermissionError();
    case '22023':
      return new ValidationError();
    default:
      return error;
  }
}

const num = (value) => (value === null || value === undefined ? 0 : Number(value));
const isoDate = (value) => {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
};
const isoDateTime = (value) =>
  value instanceof Date ? value.toISOString() : value ? String(value) : '';

// ----- Mappers (colonnes SQL → types de l'application) -----
const mapClient = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  name: r.name,
  phone: r.phone,
  email: r.email || undefined,
  segment: r.segment,
  favoriteService: r.favorite_service || '',
  notes: r.notes || '',
  totalSpent: num(r.total_spent),
  visitsCount: num(r.visits_count),
  lastVisit: isoDate(r.last_visit)
});

const mapService = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  name: r.name,
  category: r.category,
  description: r.description || '',
  price: num(r.price),
  durationMinutes: num(r.duration_minutes),
  popular: Boolean(r.popular)
});

const mapStaff = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  name: r.name,
  role: r.role,
  avatar: '',
  specialties: r.specialties || [],
  rating: 0,
  commissionRate: num(r.commission_rate),
  phone: r.phone || '',
  isAvailable: Boolean(r.is_available)
});

const mapExpense = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  title: r.title,
  category: r.category,
  amount: num(r.amount),
  date: isoDate(r.spent_on),
  paymentMethod: 'cash',
  notes: r.notes || ''
});

const mapStock = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  name: r.name,
  category: r.category,
  quantity: num(r.quantity),
  minThreshold: num(r.min_threshold),
  unitCost: num(r.unit_cost),
  supplier: r.supplier || '',
  lastRestock: ''
});

const mapReward = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  name: r.name,
  description: r.description || '',
  pointsCost: num(r.points_cost),
  category: r.category,
  isActive: Boolean(r.is_active),
  timesRedeemed: num(r.times_redeemed),
  discountPercentage: r.discount_percentage === null ? undefined : num(r.discount_percentage),
  freeServiceName: r.free_service_name || undefined,
  createdAt: isoDateTime(r.created_at)
});

const mapReview = (r) => ({
  id: r.id,
  salonId: r.salon_id,
  author: r.author,
  rating: num(r.rating),
  date: isoDate(r.created_at),
  comment: r.comment,
  verified: Boolean(r.verified)
});

export function createSalonRepository(db) {
  // `runner` est la connexion d'une requête (transaction RLS). Par défaut on
  // réutilise la connexion du repository (tests et usage interne).
  const queries = (runner) => {
    const q = runner ? (text, params) => runner.query(text, params) : (text, params) => db.query(text, params);
    const listClients = async (salonId) =>
      (await q('select * from public.bc_clients where salon_id = $1 order by name', [salonId])).rows.map(mapClient);
    const listServices = async (salonId) =>
      (await q('select * from public.bc_services where salon_id = $1 order by name', [salonId])).rows.map(mapService);
    const listStaff = async (salonId) =>
      (await q('select * from public.bc_staff where salon_id = $1 order by name', [salonId])).rows.map(mapStaff);
    const listExpenses = async (salonId) =>
      (await q('select * from public.bc_expenses where salon_id = $1 order by spent_on desc', [salonId])).rows.map(mapExpense);
    const listStock = async (salonId) =>
      (await q('select * from public.bc_stock_items where salon_id = $1 order by name', [salonId])).rows.map(mapStock);
    const listRewards = async (salonId) =>
      (await q('select * from public.bc_loyalty_rewards where salon_id = $1 order by name', [salonId])).rows.map(mapReward);
    const listReviews = async (salonId) =>
      (await q('select * from public.bc_reviews where salon_id = $1 order by created_at desc', [salonId])).rows.map(mapReview);

    return {
      /** Vue agrégée d'un salon, alimentée par une seule connexion autorisée. */
      async workspace(salonId) {
        const [salon, clients, services, staff, expenses, stock, rewards, reviews] = await Promise.all([
          q('select id, name from public.bc_salons where id = $1', [salonId]),
          q('select * from public.bc_clients where salon_id = $1 order by name', [salonId]),
          q('select * from public.bc_services where salon_id = $1 order by name', [salonId]),
          q('select * from public.bc_staff where salon_id = $1 order by name', [salonId]),
          q('select * from public.bc_expenses where salon_id = $1 order by spent_on desc', [salonId]),
          q('select * from public.bc_stock_items where salon_id = $1 order by name', [salonId]),
          q('select * from public.bc_loyalty_rewards where salon_id = $1 order by name', [salonId]),
          q('select * from public.bc_reviews where salon_id = $1 order by created_at desc', [salonId])
        ]);

        if (!salon.rows.length) throw new NotFoundError('Salon introuvable ou inaccessible.');

        return {
          salon: { id: salon.rows[0].id, name: salon.rows[0].name },
          clients: clients.rows.map(mapClient),
          services: services.rows.map(mapService),
          staff: staff.rows.map(mapStaff),
          expenses: expenses.rows.map(mapExpense),
          stock: stock.rows.map(mapStock),
          rewards: rewards.rows.map(mapReward),
          reviews: reviews.rows.map(mapReview)
        };
      },

      // ----- Mappers (colonnes SQL → types de l'application) -----
      mapClient(r) {
        return {
          id: r.id,
          salonId: r.salon_id,
          name: r.name,
          phone: r.phone,
          email: r.email || undefined,
          segment: r.segment,
          favoriteService: r.favorite_service || '',
          notes: r.notes || '',
          totalSpent: num(r.total_spent),
          visitsCount: num(r.visits_count),
          lastVisit: isoDate(r.last_visit)
        };
      },
      mapService(r) {
        return {
          id: r.id,
          salonId: r.salon_id,
          name: r.name,
          category: r.category,
          description: r.description || '',
          price: num(r.price),
          durationMinutes: num(r.duration_minutes),
          popular: Boolean(r.popular)
        };
      },
      mapStaff(r) {
        return {
          id: r.id,
          salonId: r.salon_id,
          name: r.name,
          role: r.role,
          avatar: '',
          specialties: r.specialties || [],
          rating: 0,
          commissionRate: num(r.commission_rate),
          phone: r.phone || '',
          isAvailable: Boolean(r.is_available)
        };
      },
      mapExpense(r) {
        return {
          id: r.id,
          salonId: r.salon_id,
          title: r.title,
          category: r.category,
          amount: num(r.amount),
          date: isoDate(r.spent_on),
          paymentMethod: 'cash',
          notes: r.notes || ''
        };
      },
      mapStock(r) {
        return {
          id: r.id,
          salonId: r.salon_id,
          name: r.name,
          category: r.category,
          quantity: num(r.quantity),
          minThreshold: num(r.min_threshold),
          unitCost: num(r.unit_cost),
          supplier: r.supplier || '',
          lastRestock: ''
        };
      },
      mapReward(r) {
        return {
          id: r.id,
          salonId: r.salon_id,
          name: r.name,
          description: r.description || '',
          pointsCost: num(r.points_cost),
          category: r.category,
          isActive: Boolean(r.is_active),
          timesRedeemed: num(r.times_redeemed),
          discountPercentage: r.discount_percentage === null ? undefined : num(r.discount_percentage),
          freeServiceName: r.free_service_name || undefined,
          createdAt: isoDateTime(r.created_at)
        };
      },
      mapReview(r) {
        return {
          id: r.id,
          salonId: r.salon_id,
          author: r.author,
          rating: num(r.rating),
          date: isoDate(r.created_at),
          comment: r.comment,
          verified: Boolean(r.verified)
        };
      },

      // ----- Clients -----
      async listClients(salonId) {
        const r = await q('select * from public.bc_clients where salon_id = $1 order by name', [salonId]);
        return r.rows.map(mapClient);
      },
      async createClient(salonId, data) {
        const r = await q('select public.bc_create_client($1,$2,$3,$4,$5,$6,$7) as id', [
          salonId, data.name, data.phone, data.email ?? '', data.segment ?? 'new',
          data.favoriteService ?? '', data.notes ?? ''
        ]);
        return listClients(salonId).then((rows) => rows.find((c) => c.id === r.rows[0].id));
      },
      async updateClient(salonId, id, data) {
        await q('select public.bc_update_client($1,$2,$3,$4,$5,$6,$7,$8)', [
          salonId, id, data.name, data.phone, data.email ?? '', data.segment ?? 'new',
          data.favoriteService ?? '', data.notes ?? ''
        ]);
        const rows = await listClients(salonId);
        return rows.find((c) => c.id === id);
      },
      async deleteClient(salonId, id) {
        await q('select public.bc_delete_client($1,$2)', [salonId, id]);
        return { ok: true };
      },

      // ----- Prestations -----
      async listServices(salonId) {
        const r = await q('select * from public.bc_services where salon_id = $1 order by name', [salonId]);
        return r.rows.map(mapService);
      },
      async saveService(salonId, id, data) {
        const r = await q('select public.bc_save_service($1,$2,$3,$4,$5,$6,$7,$8) as id', [
          salonId, id ?? null, data.name, data.category, data.description ?? '',
          data.price, data.durationMinutes, data.popular ?? false
        ]);
        const rows = await listServices(salonId);
        return rows.find((s) => s.id === r.rows[0].id);
      },
      async deleteService(salonId, id) {
        await q('select public.bc_delete_service($1,$2)', [salonId, id]);
        return { ok: true };
      },

      // ----- Équipe -----
      async listStaff(salonId) {
        const r = await q('select * from public.bc_staff where salon_id = $1 order by name', [salonId]);
        return r.rows.map(mapStaff);
      },
      async saveStaff(salonId, id, data) {
        const r = await q('select public.bc_save_staff($1,$2,$3,$4,$5,$6,$7,$8) as id', [
          salonId, id ?? null, data.name, data.role, data.phone ?? '',
          data.specialties ?? [], data.commissionRate, data.isAvailable ?? true
        ]);
        const rows = await listStaff(salonId);
        return rows.find((s) => s.id === r.rows[0].id);
      },
      async deleteStaff(salonId, id) {
        await q('select public.bc_delete_staff($1,$2)', [salonId, id]);
        return { ok: true };
      },

      // ----- Dépenses -----
      async listExpenses(salonId) {
        const r = await q('select * from public.bc_expenses where salon_id = $1 order by spent_on desc', [salonId]);
        return r.rows.map(mapExpense);
      },
      async addExpense(salonId, data) {
        const r = await q('select public.bc_add_expense($1,$2,$3,$4,$5,$6) as id', [
          salonId, data.title, data.category, data.amount, data.date, data.notes ?? ''
        ]);
        const rows = await listExpenses(salonId);
        return rows.find((e) => e.id === r.rows[0].id);
      },

      // ----- Stocks -----
      async listStock(salonId) {
        const r = await q('select * from public.bc_stock_items where salon_id = $1 order by name', [salonId]);
        return r.rows.map(mapStock);
      },
      async saveStockItem(salonId, id, data) {
        const r = await q('select public.bc_save_stock_item($1,$2,$3,$4,$5,$6,$7,$8) as id', [
          salonId, id ?? null, data.name, data.category, data.quantity,
          data.minThreshold, data.unitCost, data.supplier ?? ''
        ]);
        const rows = await listStock(salonId);
        return rows.find((i) => i.id === r.rows[0].id);
      },
      async deleteStockItem(salonId, id) {
        await q('select public.bc_delete_stock_item($1,$2)', [salonId, id]);
        return { ok: true };
      },

      // ----- Fidélité -----
      async listRewards(salonId) {
        const r = await q('select * from public.bc_loyalty_rewards where salon_id = $1 order by name', [salonId]);
        return r.rows.map(mapReward);
      },
      async saveReward(salonId, id, data) {
        const r = await q('select public.bc_save_reward($1,$2,$3,$4,$5,$6,$7,$8,$9) as id', [
          salonId, id ?? null, data.name, data.description ?? '', data.pointsCost,
          data.category, data.discountPercentage ?? null, data.freeServiceName ?? '',
          data.isActive ?? true
        ]);
        const rows = await listRewards(salonId);
        return rows.find((x) => x.id === r.rows[0].id);
      },
      async deleteReward(salonId, id) {
        await q('select public.bc_delete_reward($1,$2)', [salonId, id]);
        return { ok: true };
      },

      // ----- Avis -----
      async listReviews(salonId) {
        const r = await q('select * from public.bc_reviews where salon_id = $1 order by created_at desc', [salonId]);
        return r.rows.map(mapReview);
      },
      async addReview(salonId, data) {
        const r = await q('select public.bc_add_review($1,$2,$3,$4) as id', [
          salonId, data.author, data.rating, data.comment
        ]);
        const rows = await listReviews(salonId);
        return rows.find((x) => x.id === r.rows[0].id);
      },
      async deleteReview(salonId, id) {
        await q('select public.bc_delete_review($1,$2)', [salonId, id]);
        return { ok: true };
      }
    };
  };

  const repo = queries(null);
  // `withRunner(runner)` permet d'exécuter une requête dans la transaction RLS
  // ouverte par `sessionRunner.runAs` (même identité et mêmes droits).
  repo.withRunner = queries;
  return repo;
}

