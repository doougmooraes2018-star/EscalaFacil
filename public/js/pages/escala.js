// admin escala page
const calendarElAdmin   = document.getElementById('calendar');
const mesAnoElAdmin     = document.getElementById('mes-ano');
const prevBtnAdmin      = document.getElementById('prev-month');
const nextBtnAdmin      = document.getElementById('next-month');
const salvarBtnAdmin    = document.getElementById('salvar-escala');
const exportBtnAdmin    = document.getElementById('exportar-csv');
const histBtnAdmin      = document.getElementById('ver-historico');
const histSecAdmin      = document.getElementById('historico');
const histListAdmin     = document.getElementById('lista-historico');

const modalAdmin        = document.getElementById('assignment-modal');
const confirmBtnAdmin   = document.getElementById('confirm-assign');
const cancelBtnAdmin    = document.getElementById('cancel-assign');
const checkboxListAdmin = document.getElementById('checkbox-list');

let tokenAdmin = sessionStorage.getItem('token');
if (!tokenAdmin) { alert('Autenticação necessária. Faça login como gerente.'); window.location.href = '/'; }

let todayAdmin = new Date();
let mesAdmin = todayAdmin.getMonth();
let anoAdmin = todayAdmin.getFullYear();
let escalaAdmin = {};
let funcionariosAdmin = [];
let historicoAdmin = JSON.parse(localStorage.getItem('escala_logs') || '[]');
let selectedDayAdmin = null;

function keyForAdmin(m,y){ return `${y}-${String(m+1).padStart(2,'0')}`; }

async function loadFuncionariosFromAPIAdmin(){
  try {
    const r = await apiFetch('/api/users');
    if (r.ok) {
      funcionariosAdmin = await r.json();
      localStorage.setItem('funcionarios', JSON.stringify(funcionariosAdmin));
    } else {
      funcionariosAdmin = JSON.parse(localStorage.getItem('funcionarios') || '[]');
    }
  } catch (err) {
    funcionariosAdmin = JSON.parse(localStorage.getItem('funcionarios') || '[]');
  }
}

async function loadEscalaMonthAdmin(m,y){
  const key = keyForAdmin(m,y);
  try {
    const r = await apiFetch(`/api/escala/${key}`);
    escalaAdmin[key] = r.ok ? await r.json() : JSON.parse(localStorage.getItem('escala_' + key) || '{}');
  } catch (err) {
    escalaAdmin[key] = JSON.parse(localStorage.getItem('escala_' + key) || '{}');
  }
}

function renderCalendarAdmin(m,y){
  mesAnoElAdmin.textContent = `${String(m+1).padStart(2,'0')}/${y}`;
  calendarElAdmin.innerHTML = '';
  const first = new Date(y,m,1).getDay();
  const days = new Date(y,m+1,0).getDate();
  for (let i=0;i<first;i++) calendarElAdmin.appendChild(document.createElement('div'));
  const key = keyForAdmin(m,y);
  const month = escalaAdmin[key] || {};
  for (let d=1; d<=days; d++){
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.dataset.day = d;
    const h = document.createElement('header'); h.textContent = d; cell.appendChild(h);
    const list = document.createElement('div'); list.className = 'assign';
    const arr = month[String(d)] || [];
    list.textContent = arr.join(', ');
    cell.appendChild(list);
    cell.addEventListener('click', ()=> openModalAdmin(d));
    calendarElAdmin.appendChild(cell);
  }
}

async function refreshAdmin(){
  await loadFuncionariosFromAPIAdmin();
  await loadEscalaMonthAdmin(mesAdmin, anoAdmin);
  renderCalendarAdmin(mesAdmin, anoAdmin);
}

async function openModalAdmin(d){
  if (!funcionariosAdmin.length) return alert('Cadastre funcionários primeiro.');
  selectedDayAdmin = d;
  checkboxListAdmin.innerHTML = '';
  const key = keyForAdmin(mesAdmin, anoAdmin);
  const current = escalaAdmin[key] && escalaAdmin[key][d] ? escalaAdmin[key][d] : [];
  funcionariosAdmin.forEach((f,i) => {
    const id = `chk-admin-${i}`;
    const checked = current.includes(f.nome) ? 'checked' : '';
    checkboxListAdmin.insertAdjacentHTML('beforeend', `
      <label for="${id}" style="display:block;padding:.25rem 0">
        <input type="checkbox" id="${id}" value="${i}" ${checked}> ${f.nome} — ${f.funcao || f.setor || ''}
      </label>
    `);
  });
  modalAdmin.classList.remove('hidden');
}

confirmBtnAdmin.addEventListener('click', async ()=>{
  const boxes = Array.from(document.querySelectorAll('#checkbox-list input[type="checkbox"]'));
  const selected = boxes.filter(b=>b.checked).map(b => funcionariosAdmin[Number(b.value)].nome);
  const key = keyForAdmin(mesAdmin, anoAdmin);
  if (!escalaAdmin[key]) escalaAdmin[key] = {};
  if (selected.length) {
    escalaAdmin[key][selectedDayAdmin] = selected;
    historicoAdmin.unshift(`[${new Date().toLocaleString()}] Dia ${selectedDayAdmin}/${mesAdmin+1}/${anoAdmin} → ${selected.join(', ')}`);
  } else {
    delete escalaAdmin[key][selectedDayAdmin];
    historicoAdmin.unshift(`[${new Date().toLocaleString()}] Dia ${selectedDayAdmin}/${mesAdmin+1}/${anoAdmin} limpo`);
  }
  try {
    const res = await apiFetch(`/api/escala/${key}`, { method:'PUT', body: JSON.stringify(escalaAdmin[key]) });
    if (!res.ok) throw new Error('save failed');
    localStorage.setItem('escala_logs', JSON.stringify(historicoAdmin));
    modalAdmin.classList.add('hidden');
    selectedDayAdmin = null;
    renderCalendarAdmin(mesAdmin, anoAdmin);
    alert('Escala salva com sucesso.');
  } catch (err) {
    localStorage.setItem('escala_' + key, JSON.stringify(escalaAdmin[key]));
    localStorage.setItem('escala_logs', JSON.stringify(historicoAdmin));
    modalAdmin.classList.add('hidden');
    selectedDayAdmin = null;
    renderCalendarAdmin(mesAdmin, anoAdmin);
    alert('Salvo localmente (erro ao salvar via API).');
  }
});

cancelBtnAdmin.addEventListener('click', ()=>{ modalAdmin.classList.add('hidden'); selectedDayAdmin = null; });

if (salvarBtnAdmin) salvarBtnAdmin.addEventListener('click', async ()=>{
  const key = keyForAdmin(mesAdmin, anoAdmin);
  try {
    const res = await apiFetch(`/api/escala/${key}`, { method:'PUT', body: JSON.stringify(escalaAdmin[key] || {}) });
    if (!res.ok) throw new Error('save failed');
    alert('Escala salva no servidor.');
  } catch (err) {
    localStorage.setItem('escala_' + key, JSON.stringify(escalaAdmin[key] || {}));
    alert('Erro ao salvar no servidor — salvo localmente.');
  }
});

if (exportBtnAdmin) exportBtnAdmin.addEventListener('click', async ()=>{
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

if (histBtnAdmin) histBtnAdmin.addEventListener('click', ()=>{
  histSecAdmin.classList.toggle('hidden');
  histListAdmin.innerHTML = historicoAdmin.map(h => `<li>${h}</li>`).join('');
});

if (prevBtnAdmin) prevBtnAdmin.addEventListener('click', ()=>{ mesAdmin--; if (mesAdmin<0){ mesAdmin=11; anoAdmin--; } refreshAdmin(); });
if (nextBtnAdmin) nextBtnAdmin.addEventListener('click', ()=>{ mesAdmin++; if (mesAdmin>11){ mesAdmin=0; anoAdmin++; } refreshAdmin(); });

(async function init(){ await refreshAdmin(); })();
