// app.js — comportamentos globais

// páginas administrativas que exigem gerente
const adminPages = ['dashboard.html','funcionarios.html','escala.html','swap.html','availability.html','report.html'];

// current page file
const currentPage = location.pathname.split('/').pop();

// se for página admin e não houver gerente, redireciona ao index (login)
if (adminPages.includes(currentPage)) {
  const gerente = localStorage.getItem('gerente') || sessionStorage.getItem('gerente_session');
  if (!gerente) {
    window.location.href = 'index.html';
  }
}

// Registra service worker (se existir)
if ('serviceWorker' in navigator) {
  try {
    navigator.serviceWorker.register('js/sw.js').catch(()=>{});
  } catch(e){/*sw falha não crítica*/}
}

// Solicita permissão de Notificação (apenas se ainda não decidiu)
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission().catch(()=>{/*não crítico*/});
}

// Utilitário: carregar JSON seguro do localStorage
function getLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch(e){ return fallback; }
}
