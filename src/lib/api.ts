/**
 * Client HTTP unique vers l'API Barber Cuts.
 * Toutes les requêtes envoient le cookie de session (same-origin).
 */

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function parseError(res: Response): Promise<ApiError> {
  const fallback = `Erreur ${res.status}`;
  try {
    const data = await res.json();
    return new ApiError(data?.error || fallback, res.status, data?.code);
  } catch {
    return new ApiError(fallback, res.status);
  }
}

export async function apiRequest(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<any> {
  const { method = "GET", body } = options;
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return null;

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ----- Authentification -----
export const authApi = {
  session: () => apiRequest("/api/auth/session"),
  login: (email: string, password: string) =>
    apiRequest("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  signup: (name: string, email: string, password: string) =>
    apiRequest("/api/auth/signup", {
      method: "POST",
      body: { name, email, password },
    }),
  logout: () => apiRequest("/api/auth/logout", { method: "POST" }),
};

// ----- Ressources d'un salon -----
export function salonApi(salonId: string) {
  const base = `/api/salons/${salonId}`;
  const post = (p: string, data: unknown) =>
    apiRequest(p, { method: "POST", body: data });
  const put = (p: string, data: unknown) =>
    apiRequest(p, { method: "PUT", body: data });
  const del = (p: string) => apiRequest(p, { method: "DELETE" });
  return {
    workspace: () => apiRequest(`${base}/workspace`),

    clients: {
      list: () => apiRequest(`${base}/clients`),
      create: (data: unknown) => post(`${base}/clients`, data),
      update: (id: string, data: unknown) => put(`${base}/clients/${id}`, data),
      remove: (id: string) => del(`${base}/clients/${id}`),
    },
    services: {
      list: () => apiRequest(`${base}/services`),
      create: (data: unknown) => post(`${base}/services`, data),
      update: (id: string, data: unknown) =>
        put(`${base}/services/${id}`, data),
      remove: (id: string) => del(`${base}/services/${id}`),
    },
    staff: {
      list: () => apiRequest(`${base}/staff`),
      create: (data: unknown) => post(`${base}/staff`, data),
      update: (id: string, data: unknown) => put(`${base}/staff/${id}`, data),
      remove: (id: string) => del(`${base}/staff/${id}`),
    },
    expenses: {
      list: () => apiRequest(`${base}/expenses`),
      create: (data: unknown) => post(`${base}/expenses`, data),
    },
    stock: {
      list: () => apiRequest(`${base}/stock`),
      create: (data: unknown) => post(`${base}/stock`, data),
      update: (id: string, data: unknown) => put(`${base}/stock/${id}`, data),
      remove: (id: string) => del(`${base}/stock/${id}`),
    },
    rewards: {
      list: () => apiRequest(`${base}/rewards`),
      create: (data: unknown) => post(`${base}/rewards`, data),
      update: (id: string, data: unknown) => put(`${base}/rewards/${id}`, data),
      remove: (id: string) => del(`${base}/rewards/${id}`),
    },
    reviews: {
      list: () => apiRequest(`${base}/reviews`),
      create: (data: unknown) => post(`${base}/reviews`, data),
      remove: (id: string) => del(`${base}/reviews/${id}`),
    },
  };
}
