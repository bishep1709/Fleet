window.API_BASE = window.SYTBOARD_API || '/api';

async function apiCall(path, options = {}) {
  const res = await fetch(`${window.API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function scopeQuery(scope) {
  if (!scope) return '';
  return `${scope.category ? `&category=${encodeURIComponent(scope.category)}` : ''}${scope.organic ? '&organic=1' : ''}`;
}

const api = {
  login: (email, password) => apiCall('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => apiCall('/auth/logout', { method: 'POST' }),
  me: () => apiCall('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    apiCall('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  executive: (from, to, force, scope) => apiCall(`/executive?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${force ? '&refresh=1' : ''}${scopeQuery(scope)}`),
  drillSales: (range, scope, forceOrganic) => apiCall(`/drill/sales?from=${range.from}&to=${range.to}${forceOrganic ? '&forceOrganic=1' : ''}${scopeQuery(scope)}`),
  drillTraffic: (range, mode) => apiCall(`/drill/traffic?from=${range.from}&to=${range.to}&mode=${encodeURIComponent(mode || 'all')}`),
  live: () => apiCall('/live'),
  ads: (from, to) => apiCall(`/ads?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  searchDemand: () => apiCall('/search-demand'),
  presence: (page) => apiCall('/presence', { method: 'POST', body: JSON.stringify({ page }) }),
  aiStatus: () => apiCall('/ai/status'),
  aiChat: (messages, ctx = {}) => apiCall('/ai/chat', { method: 'POST', body: JSON.stringify({ messages, ...ctx }) }),
  aiBrief: (from, to, scope, refresh) => apiCall(`/ai/brief?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${refresh ? '&refresh=1' : ''}${scopeQuery(scope)}`),
  adminAi: () => apiCall('/admin/ai'),
  adminAiSave: (body) => apiCall('/admin/ai', { method: 'PUT', body: JSON.stringify(body) }),
  adminAiClear: () => apiCall('/admin/ai', { method: 'DELETE' }),
  adminAiTest: () => apiCall('/admin/ai/test', { method: 'POST' }),
  adminClarity: () => apiCall('/admin/clarity'),
  adminClaritySave: (token) => apiCall('/admin/clarity', { method: 'PUT', body: JSON.stringify({ token }) }),
  adminClarityClear: () => apiCall('/admin/clarity', { method: 'DELETE' }),
  adminGoogleAds: () => apiCall('/admin/google-ads'),
  adminDemand: () => apiCall('/admin/search-demand'),
  adminDemandImport: (body) => apiCall('/admin/search-demand', { method: 'POST', body: JSON.stringify(body) }),
  adminGoogleAdsTest: () => apiCall('/admin/google-ads/test', { method: 'POST' }),
  adminUsers: () => apiCall('/admin/users'),
  adminUserCreate: (email, role) => apiCall('/admin/users', { method: 'POST', body: JSON.stringify({ email, role }) }),
  adminUserReset: (id) => apiCall(`/admin/users/${id}/reset-password`, { method: 'POST' }),
  adminUserDelete: (id) => apiCall(`/admin/users/${id}`, { method: 'DELETE' }),
  overview: (from, to, force, scope) => apiCall(`/overview?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${force ? '&refresh=1' : ''}${scopeQuery(scope)}`),
};
