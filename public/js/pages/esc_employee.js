// Portal do Funcionário: Escala, Trocas e Chat

// --- Elementos do DOM ---
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

// --- Estado Inicial ---
const myName = sessionStorage.getItem('funcionario');
if (!myName) window.location.href = 'employee.html';

let today = new Date();
let mes   = today.getMonth();
let ano   = today.getFullYear();

// Dados locais
const feriados = { '1/1':'Confraternização Universal', '25/12':'Natal' };
let allEscalas = {}; // carregado dinamicamente
let funcionarios = JSON.parse(localStorage.getItem('funcionarios') || '[]');
let swaps       = JSON.parse(localStorage.getItem('swap_requests') || '[]');
let chatMsgs    = JSON.parse(localStorage.getItem('chat_messages') || '[]');

// --- Funções de Escala ---
function loadEscalas() {
  allEscalas = {};
  Object.keys(localStorage)
    .filter(k => k.startsWith('escala_'))
    .forEach(k => {
      const key = k.slice(7);
      allEscalas[key] = JSON.parse(localStorage.getItem(k));
    });
}

function genCalendar(m, y) {
  mesAnoEl.textContent = `${m+1}/${y}`;
  calendarEl.innerHTML = '';
  const key   = `${y}-${String(m+1).padStart(2,'0')}`;
  const month = allEscalas[key] || {};
  const firstDow = new Date(y, m, 1).getDay();
  const daysCount= new Date(y, m+1, 0).getDate();

  // espaços vazios
  for (let i=0; i<firstDow; i++) {
    calendarEl.appendChild(document.createElement('div'));
  }
  // dias
  for (let d=1; d<=daysCount; d++) {
    const cell = document.createElement('div');
    cell.className = 'day';
    const fm = `${d}/${m+1}`;
    if (feriados[fm]) { cell.classList.add('holiday'); cell.title = feriados[fm]; }
    const h = document.createElement('header');
    h.textContent = d;
    cell.appendChild(h);
    // se sou eu nesse dia
    const assigned = month[d] || [];
    if (assigned.includes(myName)) {
      cell.classList.add('my-day');
    } else {
      cell.classList.add('other-day');
      cell.style.opacity = '0.3';
    }
    calendarEl.appendChild(cell);
  }
}

// --- Funções de Swap ---
function populateSwapControls() {
  // dias em que estou de folga neste mês
  const key = `${ano}-${String(mes+1).padStart(2,'0')}`;
  const month = allEscalas[key] || {};
  swapDaySel.innerHTML = '<option value="">-- selecione --</option>';
  Object.entries(month).forEach(([d, arr]) => {
    if (arr.includes(myName)) {
      swapDaySel.insertAdjacentHTML('beforeend',
        `<option value="${d}">${d}/${mes+1}/${ano}</option>`);
    }
  });
  // colegas
  swapWithSel.innerHTML = '<option value="">-- selecione colega --</option>';
  funcionarios.forEach((f, i) => {
    if (f.nome !== myName) {
      swapWithSel.insertAdjacentHTML('beforeend',
        `<option value="${i}">${f.nome}</option>`);
    }
  });
}

function renderSwaps() {
  swapList.innerHTML = swaps
    .filter(s => s.requester === myName)
    .map((s,i) => {
      return `<li>
        Troca dia ${s.day}: com ${s.withName} —
        <strong>${s.status}</strong>
      </li>`;
    }).join('');
}

swapReqBtn.addEventListener('click', () => {
  const dayIdx = swapDaySel.value;
  const withIdx= swapWithSel.value;
  if (!dayIdx || !withIdx) return alert('Selecione dia e colega.');
  const colleague = funcionarios[withIdx].nome;
  swaps.push({
    requester: myName,
    day: dayIdx,
    withName: colleague,
    status: 'pendente',
    ts: Date.now()
  });
  localStorage.setItem('swap_requests', JSON.stringify(swaps));
  renderSwaps();
});

function showNotifications() {
  const key = 'notifications_' + myName;
  const notes = JSON.parse(localStorage.getItem(key) || '[]');
  if (notes.length) {
    notes.forEach(n => {
      if (Notification.permission === 'granted') {
        new Notification(n.title, { body: n.body || n.title });
      } else {
        alert(`${n.title}\n\n${n.body || ''}`);
      }
    });
    localStorage.removeItem(key);
  }
}

// Atualizamos o init:
function init() {
  loadEscalas();
  genCalendar(mes, ano);
  populateSwapControls();
  renderSwaps();
  showNotifications();   // <-- exibe notifs de troca aprovada/rejeitada
  renderChat();
}
init();

// --- Funções de Chat ---
function renderChat() {
  chatWindow.innerHTML = chatMsgs
    .map(m => {
      const cls = m.user === myName ? 'chat-me' : 'chat-other';
      return `<div class="${cls}">
        <span class="chat-user">${m.user}:</span>
        <span class="chat-text">${m.text}</span>
      </div>`;
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

// --- Navegação e Logout ---
prevBtn.addEventListener('click', () => {
  mes--; if (mes<0) { mes=11; ano--; }
  init();
});
nextBtn.addEventListener('click', () => {
  mes++; if (mes>11) { mes=0; ano++; }
  init();
});

logoutBtn.addEventListener('click', () => {
  sessionStorage.removeItem('funcionario');
  window.location.href = 'employee.html';
});

// --- Inicialização ---
function init() {
  loadEscalas();
  genCalendar(mes, ano);
  populateSwapControls();
  renderSwaps();
  renderChat();
}

init();
