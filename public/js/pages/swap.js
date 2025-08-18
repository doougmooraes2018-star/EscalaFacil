const fromSel = document.getElementById('swap-from');
const toSel   = document.getElementById('swap-to');
const reqBtn  = document.getElementById('swap-request');
const listEl  = document.getElementById('swap-list');

let funcs = JSON.parse(localStorage.getItem('funcionarios') || '[]');
let swaps = JSON.parse(localStorage.getItem('swap_requests') || '[]');

// Carrega escalas completas para poder editar
function loadAllEscalas() {
  const all = {};
  Object.keys(localStorage)
    .filter(k => k.startsWith('escala_'))
    .forEach(k => {
      all[k.slice(7)] = JSON.parse(localStorage.getItem(k));
    });
  return all;
}

// Salva escala no storage
function saveEscala(key, data) {
  localStorage.setItem('escala_' + key, JSON.stringify(data));
}

// Notifica um funcionário via localStorage
function notifyUser(user, title, body) {
  const key = 'notifications_' + user;
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push({ title, body, ts: Date.now() });
  localStorage.setItem(key, JSON.stringify(arr));
}

// Renderiza lista de solicitações
function renderList() {
  listEl.innerHTML = swaps
    .map((s, i) => {
      return `<li>
        ${s.from} ➔ ${s.to} (dia ${s.day}) — <strong>${s.status}</strong>
        ${s.status === 'pendente'
          ? `<button onclick="approve(${i})">✅</button>
             <button onclick="reject(${i})">❌</button>`
          : ''}
      </li>`;
    })
    .join('');
}

// Aprovar
window.approve = i => {
  const s = swaps[i];
  s.status = 'aprovado';

  const key = s.month; // exemplo: '2025-06'
  const esc = loadAllEscalas()[key] || {};
  const day = s.day;
  const arr = esc[day] || [];

  // Substitui o funcionário que solicitou a folga pelo colega
  esc[day] = arr.filter(n => n !== s.from);
  esc[day].push(s.to);
  saveEscala(key, esc);

  notifyUser(s.from, 'Troca de folga aprovada', `Sua troca de folga em ${day}/${key} foi aprovada.`);
  notifyUser(s.to, 'Nova folga atribuída', `Você recebeu folga em ${day}/${key} (troca aprovada).`);

  localStorage.setItem('swap_requests', JSON.stringify(swaps));
  renderList();
};

// Reprovar
window.reject = i => {
  const s = swaps[i];
  s.status = 'rejeitado';
  notifyUser(s.from, 'Troca de folga rejeitada', `Sua troca de folga em ${s.day}/${s.month} foi rejeitada.`);
  localStorage.setItem('swap_requests', JSON.stringify(swaps));
  renderList();
};

// Preenche os selects com nomes
function populate() {
  funcs.forEach((f) => {
    fromSel.insertAdjacentHTML('beforeend', `<option value="${f.nome}">${f.nome}</option>`);
    toSel.insertAdjacentHTML('beforeend', `<option value="${f.nome}">${f.nome}</option>`);
  });
}

// Enviar nova solicitação
reqBtn.addEventListener('click', () => {
  const from = fromSel.value;
  const to = toSel.value;
  const day = document.getElementById('swap-day').value;
  const month = day.slice(3, 10); // 'dd/mm/yyyy' → 'mm/yyyy'

  if (!from || !to || from === to || !day) {
    return alert('Selecione o dia, origem e destino corretamente.');
  }

  swaps.push({ from, to, day, month, status: 'pendente', ts: Date.now() });
  localStorage.setItem('swap_requests', JSON.stringify(swaps));
  renderList();
});

populate();
renderList();

