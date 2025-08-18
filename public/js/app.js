// Verifica login
if (!localStorage.getItem('gerente') && !location.pathname.endsWith('index.html')) {
  window.location.href='index.html';
}

// Registra service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('js/sw.js');
}

// Solicita permissão de Notificação
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}
