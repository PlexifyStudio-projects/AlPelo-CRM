/**
 * API Token Manager + Global Fetch Interceptor
 *
 * Automatically adds Bearer token to ALL fetch requests to the API.
 * This makes auth work on mobile (where cross-origin cookies are blocked).
 * Desktop still works via cookies as fallback.
 */

const TOKEN_KEY = 'plexify_token';
const API_HOST = (import.meta.env.VITE_API_URL || 'https://alpelo-crm-production.up.railway.app/api').replace('/api', '');

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Global fetch interceptor ──
// Patches window.fetch to add Authorization header to API requests
const _originalFetch = window.fetch;

window.fetch = function (url, options = {}) {
  const urlStr = typeof url === 'string' ? url : url?.url || '';

  // Only intercept requests to our API
  if (urlStr.includes('alpelo-crm-production.up.railway.app') || urlStr.includes('/api/')) {
    const token = getToken();
    if (token) {
      const headers = new Headers(options.headers || {});
      if (!headers.has('Authorization') && !headers.has('authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      options = { ...options, headers };
    }
    // Always include credentials for cookie fallback
    if (!options.credentials) {
      options.credentials = 'include';
    }
  }

  return _originalFetch.call(window, url, options);
};
