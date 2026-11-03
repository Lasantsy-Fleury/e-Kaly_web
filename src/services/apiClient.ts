/**
 * Client API REST pour le backend PostgreSQL déployé sur Render.com
 * Permet d'interagir directement avec la base de données PostgreSQL.
 */

function resolveApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();
  if (raw) {
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      return raw.endsWith('/api') ? raw : `${raw.replace(/\/+$/, '')}/api`;
    }
    return `https://${raw.replace(/\/+$/, '')}/api`;
  }
  return import.meta.env.PROD
    ? 'https://ekaly-backend.onrender.com/api'
    : 'http://localhost:10000/api';
}

const API_BASE_URL = resolveApiBaseUrl();

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorBody.error || `Erreur API: ${response.status}`);
  }

  return response.json();
}

export const ekalyApi = {
  // Health
  checkHealth: () => request<{ status: string; database: string }>('/health'),

  // Sessions
  sessions: {
    list: () => request<any[]>('/sessions'),
    get: (id: string) => request<any>(`/sessions/${id}`),
    create: (data: any) => request<any>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/sessions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ success: boolean }>(`/sessions/${id}`, { method: 'DELETE' }),
  },

  // Étudiants
  students: {
    list: (sessionId?: string) => request<any[]>(`/students${sessionId ? `?sessionId=${sessionId}` : ''}`),
    get: (id: string) => request<any>(`/students/${id}`),
    getByMatricule: (matricule: string, sessionId?: string) =>
      request<any>(`/students/by-matricule/${matricule}${sessionId ? `?sessionId=${sessionId}` : ''}`),
    create: (data: any) => request<any>('/students', { method: 'POST', body: JSON.stringify(data) }),
    batchImport: (students: any[], sessionId: string, sessionNom?: string) =>
      request<{ success: boolean; count: number }>('/students/batch', {
        method: 'POST',
        body: JSON.stringify({ students, sessionId, sessionNom }),
      }),
    update: (id: string, data: any) => request<any>(`/students/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ success: boolean }>(`/students/${id}`, { method: 'DELETE' }),
  },

  // Distributions
  distributions: {
    list: (sessionId?: string) => request<any[]>(`/distributions${sessionId ? `?sessionId=${sessionId}` : ''}`),
    get: (id: string) => request<any>(`/distributions/${id}`),
    create: (data: any) => request<any>('/distributions', { method: 'POST', body: JSON.stringify(data) }),
    createFullDay: (sessionId: string, sessionNom: string, date: string, studentCount?: number) =>
      request<{ success: boolean; distributions: any[] }>('/distributions/full-day', {
        method: 'POST',
        body: JSON.stringify({ sessionId, sessionNom, date, studentCount }),
      }),
    changeStatus: (id: string, statut: string) =>
      request<any>(`/distributions/${id}/status`, { method: 'PATCH', body: JSON.stringify({ statut }) }),
    update: (id: string, data: any) => request<any>(`/distributions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ success: boolean }>(`/distributions/${id}`, { method: 'DELETE' }),
  },

  // Pointages
  attendance: {
    list: (params?: { distributionId?: string; matricule?: string; pointeurId?: string }) => {
      const search = new URLSearchParams(params as any).toString();
      return request<any[]>(`/attendance${search ? `?${search}` : ''}`);
    },
    getSummary: (distributionId?: string) =>
      request<any[]>(`/attendance/summary${distributionId ? `?distributionId=${distributionId}` : ''}`),
    record: (data: any) => request<any>('/attendance', { method: 'POST', body: JSON.stringify(data) }),
    syncBatch: (pointages: any[]) =>
      request<{ success: boolean; syncedCount: number; conflictCount: number; failedCount: number }>(
        '/attendance/sync',
        { method: 'POST', body: JSON.stringify({ pointages }) }
      ),
    delete: (id: string) => request<{ success: boolean }>(`/attendance/${id}`, { method: 'DELETE' }),
  },

  // Utilisateurs
  users: {
    list: () => request<any[]>('/users'),
    get: (id: string) => request<any>(`/users/${id}`),
    upsert: (data: any) => request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string, role?: string) =>
      request<any>(`/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, role }) }),
    assignSession: (id: string, sessionId: string, sessionNom?: string) =>
      request<any>(`/users/${id}/session`, { method: 'PATCH', body: JSON.stringify({ sessionId, sessionNom }) }),
  },

  // Dashboard Metrics
  dashboard: {
    getStats: (sessionId?: string) =>
      request<any>(`/dashboard/stats${sessionId ? `?sessionId=${sessionId}` : ''}`),
  },

  // Audit
  audit: {
    list: (limit = 100) => request<any[]>(`/audit-logs?limit=${limit}`),
    log: (action: string, performedByUid: string, details?: any) =>
      request<any>('/audit-logs', { method: 'POST', body: JSON.stringify({ action, performedByUid, details }) }),
  },
};
