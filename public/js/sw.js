const CACHE_NAME = 'escala-cache-v1';
const ASSETS = [
  '/index.html','/dashboard.html','/funcionarios.html','/escala.html',
  '/employee.html','/esc_employee.html',
  '/css/style.css',
  '/js/app.js','/js/sw.js',
  '/js/pages/funcionarios.js','/js/pages/escala.js',
  '/js/pages/employee.js','/js/pages/esc_employee.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request)
      .then(r => r || fetch(e.request))
      .catch(() => caches.match('/offline.html'))
  );
});

// notificações push continuam iguais...
self.addEventListener('push', e => {
  const data = e.data.json();
  self.registration.showNotification(data.title, { body: data.body });
});
