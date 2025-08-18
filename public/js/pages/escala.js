// public/js/pages/escala.js

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

// Modal e seletor múltiplo
const modal        = document.getElementById('assignment-modal');
const selectEl     = document.getElementById('func-select');
const confirmBtn   = document.getElementById('confirm-assign');
const cancelBtn    = document.getElementById('cancel-assign');

let today         = new Date();
let mes           = today.getMonth();
let ano           = today.getFullYear();
let escala        = {};  // { 'YYYY-MM': { D: ['Nome1','Nome2'], ... } }
let historico     = JSON.parse(localStorage.getItem('escala_logs') || '[]');
let funcionarios  = JSON.parse(localStorage.getItem('funcionarios') || '[]');
let selectedDay   = null;

// Feriados estáticos (dia/mês)
const feriados = {
  '1/1':   'Confraternização Universal',
  '21/4':  'Tiradentes',
  '1/5':   'Dia do Trabalho',
  '7/9':   'Independência do Brasil',
  '12/10':'Nossa Sra. Aparecida',
  '2/11':  'Finados',
  '15/11':'Proclamação da República',
  '25/12': 'Natal'
};

// Gera calendário
function genCalendar(m, y) {
  mesAnoEl.textContent = `${m+1}/${y}`;
  calendarEl.innerHTML = '';

  const primeiraDow = new Date(y, m, 1).getDay();
  const totalDias   = new Date(y, m+1, 0).getDate();

  for (let i = 0; i < primeiraDow; i++) {
    calendarEl.appendChild(document.createElement('div'));
  }

  for (let d = 1; d <= totalDias; d++) {
    const cell = document.createElement('div');
    cell.className = 'day';
    cell.dataset.day = d;

    // marca feriado
    const chaveF = `${d}/${m+1}`;
    if (feriados[chaveF]) {
      cell.classList.add('holiday');
      cell.title = feriados[chaveF];
    }

    // número do dia
    const header = document.createElement('header');
    header.textContent = d;
    cell.appendChild(header);

    // nomes atribuídos (array → vírgulas)
    const assign = document.createElement('div');
    assign.className = 'assign';
    const atribs = getAssign(y, m+1, d);
    assign.textContent = Array.isArray(atribs) ? atribs.join(', ') : '';
    cell.appendChild(assign);

    cell.addEventListener('click', () => openModal(d));
    calendarEl.appendChild(cell);
  }
}

// Retorna array de atribuições ou []
function getAssign(y, mo, d) {
  const key = `${y}-${String(mo).padStart(2,'0')}`;
  return escala[key] && escala[key][d] ? escala[key][d] : [];
}

// Carrega escala do localStorage
function loadEscala() {
  const key = `${ano}-${String(mes+1).padStart(2,'0')}`;
  escala[key] = JSON.parse(localStorage.getItem('escala_' + key) || '{}');
}

// Abre modal e popula múltipla seleção
function openModal(d) {
  if (funcionarios.length === 0) {
    return alert('Cadastre funcionários antes.');
  }
  selectedDay = d;
  const container = document.getElementById('checkbox-list');
  const current = getAssign(ano, mes+1, d);
  container.innerHTML = ''; // limpa
  funcionarios.forEach((f, i) => {
    const id = `chk-${i}`;
    const checked = current.includes(f.nome) ? 'checked' : '';
    container.insertAdjacentHTML('beforeend', `
      <label for="${id}">
        <input type="checkbox" id="${id}" value="${i}" ${checked}>
        ${f.nome}
      </label>
    `);
  });
  modal.classList.remove('hidden');
}

confirmBtn.addEventListener('click', () => {
  const boxes = Array.from(document.querySelectorAll('#checkbox-list input[type="checkbox"]'));
  const selected = boxes.filter(cb => cb.checked).map(cb => funcionarios[cb.value].nome);
  const key = `${ano}-${String(mes+1).padStart(2,'0')}`;

  if (selected.length) {
    escala[key][selectedDay] = selected;
    log(`Dia ${selectedDay}/${mes+1}/${ano} → ${selected.join(', ')}`);
  } else {
    delete escala[key][selectedDay];
    log(`Dia ${selectedDay}/${mes+1}/${ano} limpo`);
  }

  saveData();
  genCalendar(mes, ano);
  closeModal();
});

// Confirma atribuições múltiplas
confirmBtn.addEventListener('click', () => {
  const opts = Array.from(selectEl.selectedOptions);
  const key  = `${ano}-${String(mes+1).padStart(2,'0')}`;

  if (opts.length) {
    escala[key][selectedDay] = opts.map(o => funcionarios[o.value].nome);
    log(`Dia ${selectedDay}/${mes+1}/${ano} → ${escala[key][selectedDay].join(', ')}`);
  } else {
    delete escala[key][selectedDay];
    log(`Dia ${selectedDay}/${mes+1}/${ano} limpo`);
  }

  saveData();
  genCalendar(mes, ano);
  closeModal();
});

// Cancela modal
cancelBtn.addEventListener('click', closeModal);
function closeModal() {
  modal.classList.add('hidden');
  selectedDay = null;
}

// Salva escala e histórico no storage e notifica
function saveData() {
  const key = `${ano}-${String(mes+1).padStart(2,'0')}`;
  localStorage.setItem('escala_' + key, JSON.stringify(escala[key]));
  localStorage.setItem('escala_logs', JSON.stringify(historico));
  notify('Escala salva', `Folgas de ${mes+1}/${ano} atualizadas.`);
}

// Exporta CSV
exportBtn.addEventListener('click', () => {
  const key = `${ano}-${String(mes+1).padStart(2,'0')}`;
  const rows = [['Dia','Funcionário(s)']];
  for (const d in escala[key]) {
    rows.push([d, escala[key][d].join('; ')]);
  }
  const blob = new Blob([rows.map(r=>r.join(',')).join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `escala_${key}.csv`; a.click(); URL.revokeObjectURL(url);
});

// Toggle Histórico
histBtn.addEventListener('click', () => {
  histSec.classList.toggle('hidden');
  histList.innerHTML = historico.map(h => `<li>${h}</li>`).join('');
});

// Grava log
function log(msg) {
  const ts = new Date().toLocaleString();
  historico.unshift(`[${ts}] ${msg}`);
}

// Notificação
function notify(title, body) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else {
    alert(`${title}\n\n${body}`);
  }
}

// Navegação de meses
prevBtn.addEventListener('click', () => {
  mes--; if (mes < 0) { mes = 11; ano--; } init();
});
nextBtn.addEventListener('click', () => {
  mes++; if (mes > 11) { mes = 0; ano++; } init();
});

// Inicialização
function init() {
  funcionarios = JSON.parse(localStorage.getItem('funcionarios') || '[]');
  loadEscala();
  genCalendar(mes, ano);
}
init();
