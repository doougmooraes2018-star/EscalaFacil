// esc_employee.js (frontend) - usa API
const calendarEl = document.getElementById('calendar');
const mesAnoEl = document.getElementById('mes-ano');
const prevBtn = document.getElementById('prev-month');
const nextBtn = document.getElementById('next-month');
const logoutBtn = document.getElementById('logout-btn');

const swapDaySel = document.getElementById('swap-day');
const swapWithSel = document.getElementById('swap-with');
const swapReqBtn = document.getElementById('swap-request');
const swapList = document.getElementById('swap-list');

const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-msg');
const chatSend = document.getElementById('chat-send');

const requestOffBtn = document.getElementById('request-off-btn');
const meInfo = document.getElementById('me-info');
const changePassForm = document.getElementById('change-pass-form');

let myName = sessionStorage.getItem('funcionario');
let token = sessionStorage.getItem('token');
if (!token || !myName) {
  window.location.href = 'employee.html';
}

let today = new Date();
let mes = today.getMonth();
let ano = today.getFullYear();

async function fetchEscalaFor(m,y){
  const key = `${y}-${String(m+1).padStart(2,'0')}`;
  const res = await apiFetch(`/api/escala/${key}`);
  if (!res.ok) return {};
  return await res.json();
}

async function loadFuncionarios(){
  // admin-only endpoint; for colleagues list we can fetch from /api/users only if admin
  // workaround: maintain list in localStorage when admin manages, otherwise request public endpoint (not implemented)
  // fallback: load from localStorage for now
  return JSON.parse(localStorage.getItem('funcionarios') || '[]');
}

async function genCalendar(m,y){
  mesAnoEl.textContent = `${String(m+1).padStart(2,'0')}/${y}`;
  calendarEl.innerHTML = '';
  const key = `${y}-${String(m+1).padStart(2,'0')}`;
  const monthData = await fetchEscalaFor(m,y);
  const firstDow = new Date(y,m,1).getDay();
  const daysCount = new Date(y,m+1,0).getDate();
  for (let i=0;i<firstDow;i++) calendarEl.appendChild(document.createElement('div'));
  for (let d=1; d<=daysCount; d++){
    const cell = document.createElement('div');
    cell.className='day';
    const h = document.createElement('header'); h.textContent = d; cell.appendChild(h);
    const assigned = monthData[String(d)] || [];
    const list = document.createElement('div'); list.className = 'assigned-list';
    if (assigned.length===0) {
      const none = document.createElement('div'); none.textContent='—'; list.appendChild(none); cell.classList.add('no-assignment');
    } else {
      assigned.forEach(n => {
        const item = document.createElement('div');
        item.textContent = n;
        if (n === myName) { item.classList.add('assigned-me'); cell.classList.add('my-day'); }
        list.appendChild(item);
      });
    }
    cell.appendChild(list);
    cell.addEventListener('click', () => {
      // select day for request off
      const prev = calendarEl.querySelector('.day.selected-off');
      if (prev) prev.classList.remove('selected-off');
      cell.classList.add('selected-off');
      cell.dataset.selected = d;
    });
    calendarEl.appendChild(cell);
  }
}

async function populateSwapControls() {
  swapDaySel.innerHTML = '<option value="">-- selecione --</option>';
  const key = `${ano}-${String(mes+1).padStart(2,'0')}`;
  const month = await fetchEscalaFor(mes,ano);
  const arrDays = Object.keys(month).map(k=>Number(k)).sort((a,b)=>a-b);
  arrDays.forEach(d=>{
    const assigned = month[String(d)] || [];
    if (assigned.includes(myName)) swapDaySel.insertAdjacentHTML('beforeend', `<option value="${d}">${d}/${mes+1}/${ano}</option>`);
  });
  swapWithSel.innerHTML = '<option value="">-- selecione colega --</option>';
  const funcs = await loadFuncionarios();
  funcs.forEach((f,i)=> { if (f.nome !== myName) swapWithSel.insertAdjacentHTML('beforeend', `<option value="${i}">${f.nome}</option>`); });
}

async function renderSwaps() {
  // show my requests (client-side)
  const res = await apiFetch('/api/swaps'); // need admin; if 403, fallback to local
  if (res.ok) {
    const items = await res.json();
    swapList.innerHTML = items.filter(s => s.requester === myName).map(s => `<li>${s.type} dia ${s.day}/${s.month} — <strong>${s.status}</strong></li>`).join('');
  } else {
    // fallback to localStorage queue
    const swaps = JSON.parse(localStorage.getItem('swap_requests') || '[]');
    swapList.innerHTML = swaps.filter(s => s.requester === myName).map(s => `<li>${s.type} dia ${s.day}/${s.month} — <strong>${s.status}</strong></li>`).join('');
  }
}

swapReqBtn.addEventListener('click', async () => {
  const dayIdx = swapDaySel.value;
  const withIdx = swapWithSel.value;
  if (!dayIdx || !withIdx) return alert('Selecione dia e colega');
  const funcs = JSON.parse(localStorage.getItem('funcionarios') || '[]');
  const colleague = funcs[withIdx].nome;
  const keyMonth = `${ano}-${String(mes+1).padStart(2,'0')}`;
  try {
    const r = await apiFetch('/api/swaps', {
      method: 'POST',
      body: JSON.stringify({ type: 'swap', requester: myName, from: myName, to: colleague, day: Number(dayIdx), month: keyMonth })
    });
    if (!r.ok) return alert('Erro ao enviar solicitação (admin pode não estar configurado)');
    alert('Solicitação enviada');
    renderSwaps();
  } catch (err) { alert('Erro de rede'); }
});

requestOffBtn.addEventListener('click', async () => {
  const selected = calendarEl.querySelector('.day.selected-off');
  if (!selected) return alert('Selecione um dia no calendário');
  const d = Number(selected.dataset.selected);
  const keyMonth = `${ano}-${String(mes+1).padStart(2,'0')}`;
  try {
    const r = await apiFetch('/api/swaps', {
      method: 'POST',
      body: JSON.stringify({ type: 'off', requester: myName, day: d, month: keyMonth })
    });
    if (!r.ok) return alert('Erro ao solicitar folga');
    alert('Pedido de folga enviado ao administrador');
    selected.classList.remove('selected-off');
    renderSwaps();
  } catch (err) { alert('Erro de rede'); }
});

// chat
async function loadChat(){
  const r = await apiFetch('/api/chat');
  if (!r.ok) return;
  const msgs = await r.json();
  chatWindow.innerHTML = msgs.map(m => `<div><strong>${m.user}:</strong> ${m.content}</div>`).join('');
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
chatSend.addEventListener('click', async () => {
  const text = chatInput.value.trim();
  if (!text) return;
  const r = await apiFetch('/api/chat', { method: 'POST', body: JSON.stringify({ content: text }) });
  if (!r.ok) return alert('Erro ao enviar mensagem');
  chatInput.value = '';
  loadChat();
});

// change password (calls admin endpoint? In this version we allow employee to change own password via PUT /api/users/:id if API allows - but admin-only protects)
changePassForm && changePassForm.addEventListener('submit', async e=>{
  e.preventDefault();
  alert('Alteração de senha por API não implementada neste build. Peça ao gerente alterar ou implemente endpoint PUT /api/users/:id para self-update.');
});

// logout
logoutBtn.addEventListener('click', ()=> { sessionStorage.clear(); window.location.href='employee.html'; });

// navigation months
prevBtn.addEventListener('click', ()=> { mes--; if (mes<0){ mes=11; ano--; } refresh(); });
nextBtn.addEventListener('click', ()=> { mes++; if (mes>11){ mes=0; ano++; } refresh(); });

async function refresh(){
  await genCalendar(mes,ano);
  await populateSwapControls();
  await renderSwaps();
  await loadChat();
}

(async function init(){
  await refresh();
  meInfo.textContent = myName;
})();
