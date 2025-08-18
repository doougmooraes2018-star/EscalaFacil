// escala.js - admin (atribuição múltipla via modal, salvar, exportar, histórico)

// Elementos do DOM
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

let today         = new Date();
let mes           = today.getMonth();
let ano           = today.getFullYear();
let escala        = {};  // { 'YYYY-MM': { D: ['Nome1','Nome2'] } }
let historico     = JSON.parse(localStorage.getItem('escala_logs') || '[]');
let funcionarios  = JSON.parse(localStorage.getItem('funcionarios') || '[]');
let selectedDay   = null;

const feriados = {
  '1/1':   'Confraternização Universal',
  '21/4':  'Tiradentes',
  '1/5':   'Dia do Trabalho',
  '7/9':   'Independência',
  '12/10':'Nossa Sra. Aparecida',
  '2/11':  'Finados',
  '15/11':'Proclamação da República',
  '25/12': 'Natal'
};

// --- util helpers ---
function getAssign(y, mo, d) {
  const key = `${y}-${String(mo).padStart(2,'0')}`;
  return escala[key] && escala[key][d] ? escala[key][d] : [];
}

function loadEscala() {
  const key = `${ano}-${String(mes+1).padStart(2,'0')}`;
  escala[key] = JSON.parse(localStorage.getItem('escala_' + key) || '{}');
}

function saveEscalaKey(key) {
  localStorage.setItem('escala_' + key, JSON.stringify(escala[key] || {}));
}

// --- Gera calendário ---
function genCalendar(m, y) {
  mesAnoEl.textContent = `${String(m+1).padStart(2,'0')}/${y}`;
  calendarEl.innerHTML = '';

  const primeiraDow = new Date(y, m, 1).getDay();
  const totalDias   = new Date(y, m+1, 0).getDate();

  for (let i = 0; i < primeiraDow; i++) calendarEl.appendChild(document.createElement('div'));

  for (let d = 1; d <= totalDias; d++) {
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.dataset.day = d;

    const chaveF = `${d}/${m+1}`;
    if (feriados[chaveF]) { cell.classList.add('holiday'); cell.title = feriados[chaveF]; }

    const header = document.createElement('header');
    header.textContent = d;
    cell.appendChild(header);

    const assign = document.createElement('div');
    assign.className = 'assign';
    const atribs = getAssign(y, m+1, d);
    assign.textContent = Array.isArray(atribs) ? atribs.join(', ') : '';
    cell.appendChild(assign);

    // abre modal para atribuir múltiplos
    cell.addEventListener('click', () => openModal(d));
    calendarEl.appendChild(cell);
  }
}

// --- Modal: abrir e popular checkboxes ---
function openModal(d) {
  if (!Array.isArray(funcionarios) || funcionarios.length === 0) {
    return alert('Cadastre funcionários antes de atribuir folgas.');
  }
  selectedDay = d;
  const key = `${ano}-${String(mes+1).padStart(2,'0')}`;
  const current = escala[key] && escala[key][d] ? escala[key][d] : [];
  checkboxList.innerHTML = '';
  funcionarios.forEach((f, i) => {
    const id = `chk-${i}`;
    const checked = current.includes(f.nome) ? 'checked' : '';
    checkboxList.insertAdjacentHTML('beforeend', `
      <label for="${id}" style="display:block;padding:.25rem 0">
        <input type="checkbox" id="${id}" value="${i}" ${checked}> ${f.nome} — ${f.funcao || f.setor || ''}
      </label>`);
  });
  modal.classList.remove('hidden');
}

// confirma seleção no modal
confirmBtn.addEventListener('click', () => {
  const boxes = Array.from(document.querySelectorAll('#checkbox-list input[type="checkbox"]'));
  const selected = boxes.filter(cb => cb.checked).map(cb => funcionarios[cb.value].nome);
  const key = `${ano}-${String(mes+1).padStart(2,'0')}`;

  if (!escala[key]) escala[key] = {};

  if (selected.length) {
    escala[key][selectedDay] = selected;
    log(`Dia ${selectedDay}/${mes+1}/${ano} → ${selected.join(', ')}`);
  } else {
    delete escala[key][selectedDay];
    log(`Dia ${selectedDay}/${mes+1}/${ano} limpo`);
  }

  saveEscalaKey(key);
  localStorage.setItem('escala_logs', JSON.stringify(historico || []));
  modal.classList.add('hidden');
  selectedDay = null;
  genCalendar(mes, ano);
});

// cancela modal
cancelBtn.addEventListener('click', () => {
  modal.classList.add('hidden');
  selectedDay = null;
});

// --- salvar (botão) ---
if (salvarBtn) {
  salvarBtn.addEventListener('click', () => {
    const key = `${ano}-${String(mes+1).padStart(2,'0')}`;
    saveEscalaKey(key);
    localStorage.setItem('escala_logs', JSON.stringify(historico || []));
    if (window.Notification && Notification.permission === 'granted') {
      new Notification('Escala salva', { body: `Folgas de ${mes+1}/${ano} atualizadas.` });
    } else {
      alert('Escala salva.');
    }
  });
}

// --- export CSV (todas escalas + chat) ---
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    const escKeys = Object.keys(localStorage).filter(k => k.startsWith('escala_'));
    if (!escKeys.length) {
      alert('Nenhuma escala encontrada para exportar.');
      return;
    }
    const rows = [['month','day','employees']];
    escKeys.forEach(k => {
      const key = k.slice(7);
      const data = JSON.parse(localStorage.getItem(k) || '{}');
      Object.keys(data).sort((a,b)=>a-b).forEach(d => rows.push([key, d, data[d].join('; ')]));
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `escala_all.csv`; a.click(); URL.revokeObjectURL(a.href);

    // export chat
    const chat = JSON.parse(localStorage.getItem('chat_messages') || '[]');
    if (chat.length) {
      const chatRows = [['ts','user','text'], ...chat.map(m => [new Date(m.ts).toISOString(), m.user, m.text])];
      const chatCsv = chatRows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob2 = new Blob([chatCsv], { type: 'text/csv;charset=utf-8;' });
      const b2 = document.createElement('a'); b2.href = URL.createObjectURL(blob2); b2.download = `chat_history.csv`; b2.click(); URL.revokeObjectURL(b2.href);
    }

    alert('Export concluído: escala_all.csv e chat_history.csv (se houver mensagens).');
  });
}

// --- histórico toggle ---
if (histBtn) {
  histBtn.addEventListener('click', () => {
    histSec.classList.toggle('hidden');
    histList.innerHTML = historico.map(h => `<li style="padding:.35rem;border-bottom:1px solid #eee">${h}</li>`).join('');
  });
}

// --- log interno de alterações ---
function log(msg) {
  const ts = new Date().toLocaleString();
  historico.unshift(`[${ts}] ${msg}`);
  localStorage.setItem('escala_logs', JSON.stringify(historico));
}

// --- navegação de meses ---
if (prevBtn) prevBtn.addEventListener('click', () => { mes--; if (mes < 0) { mes = 11; ano--; } init(); });
if (nextBtn) nextBtn.addEventListener('click', () => { mes++; if (mes > 11) { mes = 0; ano++; } init(); });

// --- init ---
function init() {
  funcionarios = JSON.parse(localStorage.getItem('funcionarios') || '[]');
  historico = JSON.parse(localStorage.getItem('escala_logs') || '[]');
  const key = `${ano}-${String(mes+1).padStart(2,'0')}`;
  escala[key] = JSON.parse(localStorage.getItem('escala_' + key) || '{}');
  genCalendar(mes, ano);
}

init();
