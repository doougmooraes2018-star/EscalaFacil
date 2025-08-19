// esc_employee.js - Portal do funcionário (mostra folgas de todos, solicitações, chat, alterar senha)
const calendarEl = document.getElementById('calendar');
const mesAnoEl   = document.getElementById('mes-ano');
const prevBtn    = document.getElementById('prev-month');
const nextBtn    = document.getElementById('next-month');
const logoutBtn  = document.getElementById('logout-btn');

const swapDaySel  = document.getElementById('swap-day');
const swapWithSel = document.getElementById('swap-with');
const swapReqBtn  = document.getElementById('swap-request');
const swapList    = document.getElementById('swap-list');

const chatWindow = document.getElementById('chat-window');
const chatInput  = document.getElementById('chat-msg');
const chatSend   = document.getElementById('chat-send');

const requestOffBtn = document.getElementById('request-off-btn');
const meInfoEl = document.getElementById('me-info');
const changePassForm = document.getElementById('change-pass-form');

let myName = sessionStorage.getItem('funcionario');
let myId   = sessionStorage.getItem('funcionario_id') || null;
if (!myName) {
  // allow visiting employee login page; otherwise redirect to login
  if (!location.pathname.endsWith('employee.html')) {
    window.location.href = 'employee.html';
  }
}

let today = new Date();
let mes   = today.getMonth();
let ano   = today.getFullYear();

const feriados = { '1/1':'Confraternização Universal', '25/12':'Natal' };
let allEscalas = {};
let funcionarios = JSON.parse(localStorage.getItem('funcionarios') || '[]');
let swaps       = JSON.parse(localStorage.getItem('swap_requests') || '[]');
let chatMsgs    = JSON.parse(localStorage.getItem('chat_messages') || '[]');

// HELPERS
function makeId() { return 'req-' + Date.now() + '-' + Math.floor(Math.random()*9999); }

function findFuncionarioByName(name) {
  if (!Array.isArray(funcionarios)) return null;
  return funcionarios.find(f => f.nome === name || f.name === name || f.fullName === name) || null;
}
function findFuncionarioById(id) {
  if (!Array.isArray(funcionarios)) return null;
  return funcionarios.find(f => String(f.id || f.nome) === String(id));
}

function formatNomeComFuncao(name) {
  const f = findFuncionarioByName(name);
  const funcao = f && (f.funcao || f.setor || f.cargo || f.role || f.position || f.titulo);
  return funcao ? `${name} — ${funcao}` : name;
}

function pushAdminNotification(title, body, url) {
  const gerente = localStorage.getItem('gerente') || 'admin';
  const key = 'notifications_' + gerente;
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push({ title, body, url, ts: Date.now() });
  localStorage.setItem(key, JSON.stringify(arr));
  if (Notification && Notification.permission === 'granted') new Notification(title, { body });
}

// Load escalas
function loadEscalas() {
  allEscalas = {};
  Object.keys(localStorage).filter(k => k.startsWith('escala_')).forEach(k => {
    const key = k.slice(7);
    try { allEscalas[key] = JSON.parse(localStorage.getItem(k)) || {}; } catch(e){ allEscalas[key] = {}; }
  });
}

let selectedOffDay = null;

function genCalendar(m, y) {
  mesAnoEl.textContent = `${String(m+1).padStart(2,'0')}/${y}`;
  calendarEl.innerHTML = '';

  const key   = `${y}-${String(m+1).padStart(2,'0')}`;
  const month = allEscalas[key] || {};
  const firstDow  = new Date(y, m, 1).getDay();
  const daysCount = new Date(y, m+1, 0).getDate();

  // espaços vazios
  for (let i=0; i<firstDow; i++) {
    const empty = document.createElement('div');
    empty.className = 'calendar-empty';
    calendarEl.appendChild(empty);
  }

  for (let d=1; d<=daysCount; d++) {
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.dataset.day = d;

    const h = document.createElement('header');
    h.textContent = d;
    cell.appendChild(h);

    const fm = `${d}/${m+1}`;
    if (feriados[fm]) { cell.classList.add('holiday'); cell.title = feriados[fm]; }

    // Lista de todos escalados para o dia (mostra Nome — Função)
    const assigned = month[String(d)] || month[d] || [];
    const list = document.createElement('div');
    list.className = 'assigned-list';

    if (assigned.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.className = 'no-assigned';
      emptyNotice.textContent = '—';
      list.appendChild(emptyNotice);
      cell.classList.add('no-assignment');
    } else {
      cell.classList.add('has-assignment');
      assigned.forEach(name => {
        const item = document.createElement('div');
        item.className = 'assigned-name';
        item.textContent = formatNomeComFuncao(name);
        if (name === myName) {
          item.classList.add('assigned-me');
          cell.classList.add('my-day');
        } else {
          item.classList.add('assigned-other');
        }
        list.appendChild(item);
      });
    }

    // clique pra selecionar dia para solicitar folga
    cell.addEventListener('click', () => {
      const prev = calendarEl.querySelector('.day.selected-off');
      if (prev) prev.classList.remove('selected-off');
      if (selectedOffDay === d) {
        selectedOffDay = null;
      } else {
        cell.classList.add('selected-off');
        selectedOffDay = d;
      }
    });

    cell.appendChild(list);
    calendarEl.appendChild(cell);
  }
}

// Swap controls (select dias que eu estou e colegas)
function populateSwapControls() {
  const key = `${ano}-${String(mes+1).padStart(2,'0')}`;
  const month = allEscalas[key] || {};

  swapDaySel.innerHTML = '<option value="">-- selecione --</option>';
  Object.keys(month).map(k=>Number(k)).sort((a,b)=>a-b).forEach(d=>{
    const arr = month[String(d)] || [];
    if (arr.includes(myName)) {
      swapDaySel.insertAdjacentHTML('beforeend', `<option value="${d}">${d}/${mes+1}/${ano}</option>`);
    }
  });

  swapWithSel.innerHTML = '<option value="">-- selecione colega --</option>';
  funcionarios.forEach((f,i)=>{
    if (f.nome !== myName) {
      const label = f.funcao ? `${f.nome} — ${f.funcao}` : f.nome;
      swapWithSel.insertAdjacentHTML('beforeend', `<option value="${i}">${label}</option>`);
    }
  });
}

function renderSwaps() {
  swapList.innerHTML = swaps.filter(s => s.requester === myName)
    .map(s => `<li>Tipo: ${s.type || 'swap'} — Dia ${s.day}/${s.month} — <strong>${s.status}</strong></li>`).join('');
}

// solicitar troca (com colega)
swapReqBtn.addEventListener('click', () => {
  const dayIdx = swapDaySel.value;
  const withIdx= swapWithSel.value;
  if (!dayIdx || !withIdx) return alert('Selecione dia e colega.');
  const colleague = funcionarios[withIdx].nome;
  const id = makeId();
  const keyMonth = `${ano}-${String(mes+1).padStart(2,'0')}`;
  const req = { id, type:'swap', requester: myName, from: myName, to: colleague, day: Number(dayIdx), month: keyMonth, status:'pendente', ts: Date.now() };
  swaps.push(req);
  localStorage.setItem('swap_requests', JSON.stringify(swaps));
  pushAdminNotification('Solicitação de troca', `${myName} solicitou troca com ${colleague} dia ${dayIdx}/${keyMonth}`, 'swap.html?focus=' + id);
  renderSwaps();
  alert('Solicitação enviada ao administrador.');
});

// Solicitar folga (off)
requestOffBtn.addEventListener('click', () => {
  if (!selectedOffDay) return alert('Selecione um dia no calendário para solicitar folga.');
  const keyMonth = `${ano}-${String(mes+1).padStart(2,'0')}`;
  const id = makeId();
  const req = { id, type:'off', requester: myName, target: null, day: Number(selectedOffDay), month: keyMonth, status:'pendente', ts: Date.now() };
  swaps.push(req);
  localStorage.setItem('swap_requests', JSON.stringify(swaps));
  pushAdminNotification('Nova solicitação de folga', `${myName} pediu folga em ${selectedOffDay}/${keyMonth}`, 'swap.html?focus=' + id);
  alert('Solicitação enviada ao administrador.');
  const prev = calendarEl.querySelector('.day.selected-off');
  if (prev) prev.classList.remove('selected-off');
  selectedOffDay = null;
  renderSwaps();
});

// Notifications pessoais (aprovacoes/rejeições)
function showNotifications() {
  const key = 'notifications_' + myName;
  const notes = JSON.parse(localStorage.getItem(key) || '[]');
  if (notes.length) {
    notes.forEach(n => {
      if (Notification && Notification.permission === 'granted') new Notification(n.title, { body: n.body || n.title });
      else alert(`${n.title}\n\n${n.body || ''}`);
    });
    localStorage.removeItem(key);
  }
}

// Chat
function renderChat() {
  chatWindow.innerHTML = chatMsgs.map(m => {
    const cls = m.user === myName ? 'chat-me' : 'chat-other';
    return `<div class="${cls}"><span class="chat-user">${m.user}:</span> <span class="chat-text">${m.text}</span></div>`;
  }).join('');
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

chatSend.addEventListener('click', () => {
  const text = chatInput.value.trim();
  if (!text) return;
  chatMsgs.push({ user: myName, text, ts: Date.now() });
  localStorage.setItem('chat_messages', JSON.stringify(chatMsgs));
  chatInput.value = '';
  renderChat();
});

// ALTERAR SENHA (funcionário)
if (changePassForm) {
  changePassForm.addEventListener('submit', e => {
    e.preventDefault();
    const oldP = document.getElementById('old-pass').value.trim();
    const newP = document.getElementById('new-pass').value.trim();
    const newP2= document.getElementById('new-pass2').value.trim();
    if (!newP) return alert('Informe a nova senha.');
    if (newP !== newP2) return alert('As senhas não coincidem.');

    // encontra funcionário e valida old password (se existir)
    const idx = funcionarios.findIndex(f => f.nome === myName || String(f.id) === String(myId));
    if (idx === -1) return alert('Usuário não encontrado (erro).');
    const f = funcionarios[idx];
    if (f.senha && oldP !== f.senha) return alert('Senha atual incorreta.');
    funcionarios[idx].senha = newP;
    localStorage.setItem('funcionarios', JSON.stringify(funcionarios));
    alert('Senha atualizada com sucesso.');
    changePassForm.reset();
  });
}

// Navegação e logout
prevBtn.addEventListener('click', () => { mes--; if (mes<0) { mes=11; ano--; } refresh(); });
nextBtn.addEventListener('click', () => { mes++; if (mes>11) { mes=0; ano++; } refresh(); });

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('funcionario');
  sessionStorage.removeItem('funcionario_id');
  window.location.href = 'employee.html';
});

// refresh / init
function populateMeInfo() {
  if (!myName) return;
  const f = findFuncionarioByName(myName) || findFuncionarioById(myId);
  if (f) {
    meInfoEl.textContent = `${f.nome} — ${f.funcao || f.setor || ''}`;
  } else {
    meInfoEl.textContent = myName;
  }
}

function populateSwapDaySelect() {
  // ensure swap-day has options for days the logged user is assigned in current month
  swapDaySel.innerHTML = '<option value="">-- selecione --</option>';
  const key = `${ano}-${String(mes+1).padStart(2,'0')}`;
  const month = allEscalas[key] || {};
  Object.keys(month).map(k=>Number(k)).sort((a,b)=>a-b).forEach(d=>{
    const arr = month[String(d)] || [];
    if (arr.includes(myName)) {
      swapDaySel.insertAdjacentHTML('beforeend', `<option value="${d}">${d}/${mes+1}/${ano}</option>`);
    }
  });
}

function refresh() {
  funcionarios = JSON.parse(localStorage.getItem('funcionarios') || '[]');
  swaps = JSON.parse(localStorage.getItem('swap_requests') || '[]');
  chatMsgs = JSON.parse(localStorage.getItem('chat_messages') || '[]');
  loadEscalas();
  genCalendar(mes, ano);
  populateSwapControls();
  renderSwaps();
  renderChat();
  populateMeInfo();
}

function init() {
  funcionarios = JSON.parse(localStorage.getItem('funcionarios') || '[]');
  swaps = JSON.parse(localStorage.getItem('swap_requests') || '[]');
  chatMsgs = JSON.parse(localStorage.getItem('chat_messages') || '[]');
  loadEscalas();
  genCalendar(mes, ano);
  populateSwapControls();
  renderSwaps();
  showNotifications();
  renderChat();
  populateMeInfo();
}
init();
