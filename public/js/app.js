// public/js/app.js  (CORRIGIDO)
// helper global que usa base relativa por padrão.
// Se você precisar usar uma API externa, defina window.API_URL = 'https://seu-backend.com' antes de carregar este script.

(function(global){
  // Se window.API_URL estiver definido e for string não-vazia, usa; senão usa '' (requests relativos)
  const API_BASE = (typeof global.API_URL === 'string' && global.API_URL.trim().length) ? global.API_URL.replace(/\/$/, '') : '';

  // Expor para debug
  global.API_BASE = API_BASE;

  global.apiFetch = async function(path, opts = {}) {
    // path normalmente começa com '/api/...'
    const url = path.startsWith('http') ? path : (API_BASE + path);
    const token = sessionStorage.getItem('token');
    const headers = opts.headers || {};
    if (!headers['Content-Type'] && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, { ...opts, headers });
    if (res.status === 401) {
      // se token inválido expira sessão e redireciona (não faz nada em páginas de login)
      if (!location.pathname.endsWith('employee.html') && !location.pathname.endsWith('index.html')) {
        alert('Sessão expirada. Faça login novamente.');
        sessionStorage.clear();
        location.href = '/';
      }
    }
    return res;
  };
})(window);
