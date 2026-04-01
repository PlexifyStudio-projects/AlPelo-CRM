const TOKEN_KEY = 'plexify_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

const _originalFetch = window.fetch;

window.fetch = function (url, options = {}) {
  const urlStr = typeof url === 'string' ? url : url?.url || '';

  if (urlStr.includes('alpelo-crm-production.up.railway.app') || urlStr.includes('/api/')) {
    const token = getToken();
    if (token) {
      const headers = new Headers(options.headers || {});
      if (!headers.has('Authorization') && !headers.has('authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      options = { ...options, headers };
    }
    if (!options.credentials) {
      options.credentials = 'include';
    }

    const locationId = localStorage.getItem('plexify_location');
    if (locationId && locationId !== 'all' && options.method !== 'POST' && options.method !== 'PUT' && options.method !== 'DELETE') {
      try {
        const u = new URL(urlStr.startsWith('http') ? urlStr : `${window.location.origin}${urlStr}`);
        if (!u.searchParams.has('location_id')) {
          u.searchParams.set('location_id', locationId);
          url = u.toString();
        }
      } catch { /* skip */ }
    }
  }

  return _originalFetch.call(window, url, options).then((response) => {
    if (response.status === 401 && urlStr.includes('/api/') && !urlStr.includes('/auth/') && !window.__sessionReplacedTriggered) {
      const cloned = response.clone();
      cloned.json().then((data) => {
        if (data?.detail === 'SESSION_REPLACED' && !window.__sessionReplacedTriggered) {
          window.__sessionReplacedTriggered = true;
          clearToken();
          localStorage.removeItem('plexify_user');
          localStorage.removeItem('plexify_auth');
          window.dispatchEvent(new CustomEvent('session-replaced'));
        }
      }).catch(() => {});
    }
    return response;
  });
};
