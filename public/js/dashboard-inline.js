// public/js/dashboard-inline.js
const gerente = localStorage.getItem('gerente') || sessionStorage.getItem('gerente_session') || 'Gerente';
document.getElementById('nome-gerente').textContent = gerente;

// contador de trocas pendentes
const swaps = JSON.parse(localStorage.getItem('swap_requests') || '[]');
const pending = swaps.filter(s => s.status === 'pendente').length;
if (pending > 0) {
  document.getElementById('swap-count').textContent = pending;
  document.getElementById('swap-notif').classList.remove('hidden');
  document.getElementById('swap-notif').style.display = 'flex';
}

// abrir fila: tenta abrir a URL da última notificação do gerente
document.getElementById('open-swaps').addEventListener('click', () => {
  const key = 'notifications_' + gerente;
  const notes = JSON.parse(localStorage.getItem(key) || '[]');
  if (notes && notes.length) {
    const last = notes[notes.length - 1];
    if (last.url) window.location.href = last.url;
    else window.location.href = 'swap.html';
  } else {
    window.location.href = 'swap.html';
  }
});

document.getElementById('logout-admin').addEventListener('click', () => {
  localStorage.removeItem('gerente');
  sessionStorage.removeItem('gerente_session');
  window.location.href = 'index.html';
});
