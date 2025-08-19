// portal do funcionário: ver escala, chat, solicitar folga e swap
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
  // use local copy (admin updates will mirror)
  return JSON.parse(localStorage.getItem('funcionarios') || '[]');
}

async function genCalendar(m,y){
  mesAnoEl.textContent = `${String(m+1).padStart(2,'0')}/${y}`;
  calendarEl.innerHTML = '';
  const monthData = await fetchEscalaFor(m,y);
  const firstDow = new Date(y,m,1).getDay();
  const daysCount = new Date(y,m+1,0).getDate();
  for (let i=0;i<firstDow;i++) calendarEl.appendChild(document.createElement('div'));
  for (let d=1; d<=daysCount; d++){
    const cell = document.createElement('div');
    cell.className='day';
    const h = document.createElement('header'); h.textContent = d; cell.appendChild(h);
    const assigned = monthData[String(d)] || [];
    const list = document.createElement('div'); list.className = 'assign';
    if (assigned.length===0) {
      list.textContent='—';
      cell.classList.add('no-assignment');
    } else {
      list.textContent = assigned.join(', ');
      if (assigned.includes(myName)) cell.classList.add('my-day');
    }
    cell.appendChild(list);
    cell.addEventListener('click', () => {
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
  const month = await fetchEscalaFor(mes,ano);
  Object.keys(month).map(k => Number(k)).sort((a,b)=>a-b).forEach(d => {
    const arr = month[String(d)] || [];
    if (arr.includes(myName)) {
      swapDaySel.insertAdjacentHTML('beforeend', `<option value="${d}">${d}/${mes+1}/${ano}</option>`);
    }
  });
  swapWithSel.innerHTML = '<option value="">-- selecione colega --</option>';
  const funcs = await loadFuncionarios();
  funcs.forEach((f,i)=> { if (f.nome !== myName) swapWithSel.insertAdjacentHTML('beforeend', `<option value="${i}">${f.nome}</option>`); });
}

async function renderSwaps() {
  const res = await apiFetch('/api/swaps');
  if (res.ok) {
    const items = await res.json();
    swapList.innerHTML = items.filter(s => s.requester === myName).map(s => `<li>${s.type} dia ${s.day}/${s.month} — <strong>${s.status}</strong></li>`).join('');
  } else {
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
    if (!r.ok) return alert('Erro ao enviar solicitação');
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

changePassForm && changePassForm.addEventListener('submit', async e=>{
  e.preventDefault();
  const oldP = document.getElementById('old-pass').value;
  const newP = document.getElementById('new-pass').value;
  const newP2 = document.getElementById('new-pass2').value;
  if (newP !== newP2) return alert('Senhas não batem');
  const id = sessionStorage.getItem('funcionario_id');
  if (!id) return alert('ID não encontrado');
  const r = await apiFetch(`/api/users/${id}/self`, { method: 'PUT', body: JSON.stringify({ oldPassword: oldP, newPassword: newP }) });
  if (!r.ok) { const j = await r.json(); return alert(j.error || 'Erro ao alterar senha'); }
  alert('Senha alterada com sucesso');
});

logoutBtn.addEventListener('click', ()=> { sessionStorage.clear(); window.location.href='employee.html'; });

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
