// docs/js/pages/escala.js
// Admin page: carregar escala via API, editar atribuições (modal), salvar

const calendarEl   = document.getElementById('calendar');
const mesAnoEl     = document.getElementById('mes-ano');
const prevBtn      = document.getElementById('prev-month');
const nextBtn      = document.getElementById('next-month');
const salvarBtn    = document.getElementById('salvar-escala');
const exportBtn    = document.getElementById('exportar-csv');
const histBtn      = document.getElementById('ver-historico');
const histSec      = document.getElementById('historico');
const histList     = document.getElementById('lista-historico');

const modal        = document.getElementById('assignment-modal');
const confirmBtn   = document.getElementById('confirm-assign');
const cancelBtn    = document.getElementById('cancel-assign');
const checkboxList = document.getElementById('checkbox-list');

let token = sessionStorage.getItem('token');
if (!token) {
  alert('Autenticação necessária. Faça login como gerente.');
  window.location.href = 'index.html';
}

let today = new Date();
let mes = today.getMonth();
let ano = today.getFullYear();
let escala = {}; // monthKey -> { day: [names...] }
let funcionarios = [];
let historico = JSON.parse(localStorage.getItem('escala_logs') || '[]');
let selectedDay = null;

function keyFor(m,y){ return `${y}-${String(m+1).padStart(2,'0')}`; }

async function apiGET(path){ const r = await apiFetch(path); if (!r.ok) throw new Error('erro'); return r.json(); }
async function apiPUT(path, body){ return await apiFetch(path, { method:'PUT', body: JSON.stringify(body) }); }

async function loadFuncionariosFromAPI(){
  try {
    const r = await apiFetch('/api/users');
    if (r.ok) {
      funcionarios = await r.json();
      // also mirror to localStorage so employee pages can fallback if needed
      localStorage.setItem('funcionarios', JSON.stringify(funcionarios));
    } else {
      // fallback to localStorage
      funcionarios = JSON.parse(localStorage.getItem('funcionarios') || '[]');
    }
  } catch (err) {
    funcionarios = JSON.parse(localStorage.getItem('funcionarios') || '[]');
  }
}

async function loadEscalaMonth(m,y){
  const key = keyFor(m,y);
  try {
    const data = await apiGET(`/api/escala/${key}`);
    escala[key] = data || {};
  } catch (err) {
    escala[key] = JSON.parse(localStorage.getItem('escala_' + key) || '{}');
  }
}

function renderCalendar(m,y){
  mesAnoEl.textContent = `${String(m+1).padStart(2,'0')}/${y}`;
  calendarEl.innerHTML = '';
  const first = new Date(y,m,1).getDay();
  const days = new Date(y,m+1,0).getDate();
  for (let i=0;i<first;i++) calendarEl.appendChild(document.createElement('div'));
  const key = keyFor(m,y);
  const month = escala[key] || {};
  for (let d=1; d<=days; d++){
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.dataset.day = d;
    const h = document.createElement('header'); h.textContent = d; cell.appendChild(h);
    const assign = document.createElement('div'); assign.className = 'assign';
    const list = month[String(d)] || [];
    assign.textContent = list.join(', ');
    cell.appendChild(assign);
    cell.addEventListener('click', ()=> openModal(d));
    calendarEl.appendChild(cell);
  }
}

async function refresh(){
  await loadFuncionariosFromAPI();
  await loadEscalaMonth(mes, ano);
  renderCalendar(mes, ano);
}

async function openModal(d){
  if (!funcionarios.length) return alert('Cadastre funcionários primeiro.');
  selectedDay = d;
  checkboxList.innerHTML = '';
  const key = keyFor(mes, ano);
  const current = escala[key] && escala[key][d] ? escala[key][d] : [];
  funcionarios.forEach((f,i) => {
    const id = `chk-${i}`;
    const checked = current.includes(f.nome) ? 'checked' : '';
    checkboxList.insertAdjacentHTML('beforeend', `
      <label for="${id}" style="display:block;padding:.25rem 0">
        <input type="checkbox" id="${id}" value="${i}" ${checked}> ${f.nome} — ${f.funcao || f.setor || ''}
      </label>
    `);
  });
  modal.classList.remove('hidden');
}

confirmBtn.addEventListener('click', async ()=>{
  const boxes = Array.from(document.querySelectorAll('#checkbox-list input[type="checkbox"]'));
  const selected = boxes.filter(b=>b.checked).map(b => funcionarios[Number(b.value)].nome);
  const key = keyFor(mes, ano);
  if (!escala[key]) escala[key] = {};
  if (selected.length) {
    escala[key][selectedDay] = selected;
    historico.unshift(`[${new Date().toLocaleString()}] Dia ${selectedDay}/${mes+1}/${ano} → ${selected.join(', ')}`);
  } else {
    delete escala[key][selectedDay];
    historico.unshift(`[${new Date().toLocaleString()}] Dia ${selectedDay}/${mes+1}/${ano} limpo`);
  }
  // save API
  try {
    const res = await apiPUT(`/api/escala/${key}`, escala[key]);
    if (!res.ok) throw new Error('save failed');
    localStorage.setItem('escala_logs', JSON.stringify(historico));
    modal.classList.add('hidden');
    selectedDay = null;
    renderCalendar(mes, ano);
    alert('Escala salva com sucesso.');
  } catch (err) {
    // fallback to local storage
    localStorage.setItem('escala_' + key, JSON.stringify(escala[key]));
    localStorage.setItem('escala_logs', JSON.stringify(historico));
    modal.classList.add('hidden');
    selectedDay = null;
    renderCalendar(mes, ano);
    alert('Salvo localmente (erro ao salvar via API).');
  }
});

cancelBtn.addEventListener('click', ()=>{ modal.classList.add('hidden'); selectedDay = null; });

if (salvarBtn) salvarBtn.addEventListener('click', async ()=>{
  const key = keyFor(mes, ano);
  try {
    const res = await apiPUT(`/api/escala/${key}`, escala[key] || {});
    if (!res.ok) throw new Error('save failed');
    alert('Escala salva no servidor.');
  } catch (err) {
    localStorage.setItem('escala_' + key, JSON.stringify(escala[key] || {}));
    alert('Erro ao salvar no servidor — salvo localmente.');
  }
});

if (exportBtn) exportBtn.addEventListener('click', async ()=>{
  try {
    const r1 = await apiFetch('/api/reports/escala_csv');
    if (r1.ok) {
      const blob = await r1.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `escala_all.csv`; a.click(); URL.revokeObjectURL(a.href);
    } else alert('Erro export escala (verifique autenticação).');
    const r2 = await apiFetch('/api/reports/chat_csv');
    if (r2.ok) {
      const blob2 = await r2.blob();
      const b = document.createElement('a'); b.href = URL.createObjectURL(blob2);
      b.download = `chat_history.csv`; b.click(); URL.revokeObjectURL(b.href);
    }
  } catch (err) { alert('Erro ao exportar'); }
});

if (histBtn) histBtn.addEventListener('click', ()=>{
  histSec.classList.toggle('hidden');
  histList.innerHTML = historico.map(h => `<li>${h}</li>`).join('');
});

if (prevBtn) prevBtn.addEventListener('click', ()=>{ mes--; if (mes<0){ mes=11; ano--; } refresh(); });
if (nextBtn) nextBtn.addEventListener('click', ()=>{ mes++; if (mes>11){ mes=0; ano++; } refresh(); });

(async function init(){ await refresh(); })();
