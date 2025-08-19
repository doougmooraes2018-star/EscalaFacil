// public/js/app.js - global helpers
window.apiFetch = async function(path, opts = {}) {
  const token = sessionStorage.getItem('token');
  const headers = opts.headers || {};
  if (!headers['Content-Type'] && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch((path.startsWith('/api') ? path : path), { ...opts, headers });
  if (res.status === 401) {
    // redirect if unauthorized and not login pages
    if (!location.pathname.endsWith('employee.html') && !location.pathname.endsWith('index.html')) {
      alert('Sessão expirada. Faça login novamente.');
      sessionStorage.clear();
      location.href = '/';
    }
  }
  return res;
};
