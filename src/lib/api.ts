/**
 * Client HTTP unique vers l'API Barber Cuts.
 * Toutes les requêtes envoient le cookie de session (same-origin).
 */

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function parseError(res) {
  const fallback = `Erreur ${res.status}`;
  try {
    const data = await res.json();
    return new ApiError(data?.error || fallback, res.status, data?.code);
  } catch {
    return new ApiError(fallback, res.status);
  }
}

export async function apiRequest(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return null;

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ----- Authentification -----
export const authApi = {
  session: () => apiRequest('/api/auth/session'),
  login: (email, password) =>
    apiRequest('/api/auth/login', { method: 'POST', body: { email, password } }),
  signup: (name, email, password) =>
    apiRequest('/api/auth/signup', { method: 'POST', body: { name, email, password } }),
  logout: () => apiRequest('/api/auth/logout', { method: 'POST' })
};

// ----- Ressources d'un salon -----
export function salonApi(salonId) {
  const base = `/api/salons/${salonId}`;
  return {
    workspace: () => apiRequest(`${base}/workspace`),

    clients: {
      list: () => apiRequest(`${base}/clients`),
      create: (data) => apiRequest(`${base}/clients`, { method: 'POST', body: data }),
      update: (id, data) => apiRequest(`${base}/clients/${id}`, { method: 'PUT', body: data }),
      remove: (id) => apiRequest(`${base}/clients/${id}`, { method: 'DELETE' })
    },
    services: {
      list: () => apiRequest(`${base}/services`),
      create: (data) => apiRequest(`${base}/services`, { method: 'POST', body: data }),
      update: (id, data) => apiRequest(`${base}/services/${id}`, { method: 'PUT', body: data }),
      remove: (id) => apiRequest(`${base}/services/${id}`, { method: 'DELETE' })
    },
    staff: {
      list: () => apiRequest(`${base}/staff`),
      create: (data) => apiRequest(`${base}/staff`, { method: 'POST', body: data }),
      update: (id, data) => apiRequest(`${base}/staff/${id}`, { method: 'PUT', body: data }),
      remove: (id) => apiRequest(`${base}/staff/${id}`, { method: 'DELETE' })
    },
    expenses: {
      list: () => apiRequest(`${base}/expenses`),
      create: (data) => apiRequest(`${base}/expenses`, { method: 'POST', body: data })
    },
    stock: {
      list: () => apiRequest(`${base}/stock`),
      create: (data) => apiRequest(`${base}/stock`, { method: 'POST', body: data }),
      update: (id, data) => apiRequest(`${base}/stock/${id}`, { method: 'PUT', body: data }),
      remove: (id) => apiRequest(`${base}/stock/${id}`, { method: 'DELETE' })
    },
    rewards: {
      list: () => apiRequest(`${base}/rewards`),
      create: (data) => apiRequest(`${base}/rewards`, { method: 'POST', body: data }),
      update: (id, data) => apiRequest(`${base}/rewards/${id}`, { method: 'PUT', body: data }),
      remove: (id) => apiRequest(`${base}/rewards/${id}`, { method: 'DELETE' })
    },
    reviews: {
      list: () => apiRequest(`${base}/reviews`),
      create: (data) => apiRequest(`${base}/reviews`, { method: 'POST', body: data }),
      remove: (id) => apiRequest(`${base}/reviews/${id}`, { method: 'DELETE' })
    }
  };
}
