// swap.js - admin page para aprovar/rejeitar solicitações (com foco de notificação)

// Elementos
const listEl = document.getElementById('swap-list');

// Estado
let funcs = JSON.parse(localStorage.getItem('funcionarios') || '[]');
let swaps = JSON.parse(localStorage.getItem('swap_requests') || '[]');

// --- Helpers de escala / storage / notificação ---
function loadAllEscalas() {
  const all = {};
  Object.keys(localStorage)
    .filter(k => k.startsWith('escala_'))
    .forEach(k => {
      try {
        all[k.slice(7)] = JSON.parse(localStorage.getItem(k)) || {};
      } catch (e) {
        all[k.slice(7)] = {};
      }
    });
  return all;
}

function saveEscala(key, data) {
  localStorage.setItem('escala_' + key, JSON.stringify(data || {}));
}

function notifyUser(user, title, body) {
  const key = 'notifications_' + user;
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push({ title, body, ts: Date.now() });
  localStorage.setItem(key, JSON.stringify(arr));
  // tenta Notification API
  if (window.Notification && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

// --- Render da fila de solicitações ---
function renderList() {
  swaps = JSON.parse(localStorage.getItem('swap_requests') || '[]'); // recarrega sempre
  listEl.innerHTML = swaps.map((s, i) => {
    const typeLabel = s.type === 'off' ? 'Folga' : 'Troca';
    const who = s.requester || s.from || s.requester || '';
    const other = s.type === 'swap' ? (s.to || s.target || '') : '';
    const when = `${s.day}/${s.month}`;
    const status = `<strong>${s.status}</strong>`;
    const actions = (s.status === 'pendente') ? `<button onclick="approve(${i})" class="small-btn">✅</button> <button onclick="reject(${i})" class="small-btn">❌</button>` : '';
    return `<li id="req-${s.id}" style="padding:.5rem;border-bottom:1px solid #eee;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem">
        <div>
          <div style="font-weight:700">${typeLabel} — ${who}${other ? ' → ' + other : ''}</div>
          <div style="font-size:.9rem;color:#444">${when} • ${s.ts ? new Date(s.ts).toLocaleString() : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem">
          ${status}
          ${actions}
        </div>
      </div>
    </li>`;
  }).join('');

  if (!swaps.length) {
    listEl.innerHTML = '<li>Nenhuma solicitação encontrada.</li>';
  }
}

// --- Ações: aprovar / rejeitar ---
window.approve = i => {
  swaps = JSON.parse(localStorage.getItem('swap_requests') || '[]');
  const s = swaps[i];
  if (!s) return alert('Solicitação não encontrada.');

  const key = s.month; // 'YYYY-MM'
  const all = loadAllEscalas();
  const esc = all[key] || {};

  if (s.type === 'off') {
    esc[s.day] = esc[s.day] || [];
    if (!esc[s.day].includes(s.requester)) esc[s.day].push(s.requester);
    saveEscala(key, esc);
    notifyUser(s.requester, 'Folga aprovada', `Sua folga em ${s.day}/${key} foi aprovada.`);
  } else if (s.type === 'swap') {
    const day = s.day;
    esc[day] = esc[day] || [];
    // remove quem solicitou e adiciona o novo colega
    esc[day] = esc[day].filter(n => n !== (s.from || s.requester));
    if (!esc[day].includes(s.to || s.target)) esc[day].push(s.to || s.target);
    saveEscala(key, esc);
    notifyUser(s.from || s.requester, 'Troca aprovada', `Sua troca em ${day}/${key} foi aprovada.`);
    notifyUser(s.to || s.target, 'Troca confirmada', `Você recebeu folga em ${day}/${key}.`);
  }

  // atualiza status
  s.status = 'aprovado';
  swaps[i] = s;
  localStorage.setItem('swap_requests', JSON.stringify(swaps));
  renderList();
};

window.reject = i => {
  swaps = JSON.parse(localStorage.getItem('swap_requests') || '[]');
  const s = swaps[i];
  if (!s) return alert('Solicitação não encontrada.');
  s.status = 'rejeitado';
  swaps[i] = s;
  localStorage.setItem('swap_requests', JSON.stringify(swaps));
  notifyUser(s.requester || s.from, 'Solicitação rejeitada', `Sua solicitação em ${s.day}/${s.month} foi rejeitada.`);
  renderList();
};

// --- Inicialização / foco a partir de notificação ---
function init() {
  // limpa notificações do gerente (consideramos o gerente atual)
  const gerente = localStorage.getItem('gerente') || sessionStorage.getItem('gerente_session') || null;
  if (gerente) {
    // manter histórico, mas podemos remover notificações consumidas:
    localStorage.removeItem('notifications_' + gerente);
  }

  swaps = JSON.parse(localStorage.getItem('swap_requests') || '[]');
  funcs = JSON.parse(localStorage.getItem('funcionarios') || '[]');

  renderList();

  // foco via query param ?focus=req-id
  const params = new URLSearchParams(location.search);
  const focus = params.get('focus');
  if (focus) {
    setTimeout(() => {
      const el = document.getElementById('req-' + focus);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.transition = 'background 1s';
        el.style.background = 'rgba(255,250,200,0.95)';
      }
    }, 250);
  }
}

init();
