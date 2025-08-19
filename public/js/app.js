// public/js/app.js - helper global que usa caminho relativo por padrão
(function(global){
  // Se quiser apontar para outro host, defina window.API_URL antes de carregar este arquivo.
  const API_BASE = (typeof global.API_URL === 'string' && global.API_URL.trim()) ? global.API_URL.replace(/\/$/,'') : '';

  global.API_BASE = API_BASE;

  global.apiFetch = async function(path, opts = {}) {
    const url = path.startsWith('http') ? path : (API_BASE + path);
    const token = sessionStorage.getItem('token');
    const headers = opts.headers || {};
    if (!headers['Content-Type'] && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) {
      if (!location.pathname.endsWith('employee.html') && !location.pathname.endsWith('index.html')) {
        alert('Sessão expirada. Faça login novamente.');
        sessionStorage.clear();
        location.href = '/';
      }
    }
    return res;
  };
})(window);
