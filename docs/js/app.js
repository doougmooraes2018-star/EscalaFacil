// app.js - config global do frontend
const API_URL = '<REPLACE_WITH_BACKEND_URL>'; // <<--- substitua pelo URL do seu backend (ex: https://escala-backend.up.railway.app)
window.API_URL = API_URL;

// helper fetch com token
async function apiFetch(path, opts = {}) {
  const token = sessionStorage.getItem('token');
  const headers = opts.headers || {};
  headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API_URL + path, { ...opts, headers });
  if (res.status === 401) {
    // redirect to login if unauthorized
    if (!location.pathname.endsWith('employee.html') && !location.pathname.endsWith('index.html')) {
      alert('Sessão expirada. Faça login novamente.');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('funcionario');
      window.location.href = 'employee.html';
    }
  }
  return res;
}
