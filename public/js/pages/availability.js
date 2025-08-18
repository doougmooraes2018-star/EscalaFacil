// availability.js - solicitar folga no mês seguinte
const cal = document.getElementById('avail-calendar');
const requestBtn = document.getElementById('request-off-availability');
let funcionarios = JSON.parse(localStorage.getItem('funcionarios') || '[]');
const me = sessionStorage.getItem('funcionario');
let today = new Date();
let m = today.getMonth();
let y = today.getFullYear();
let monthOffset = 1; // mês seguinte por padrão
let selDay = null;

function makeId(){ return 'req-' + Date.now() + '-' + Math.floor(Math.random()*9999); }

function renderCalendarForOffset(offset){
  const date = new Date(y, m + offset, 1);
  const mo = date.getMonth();
  const yr = date.getFullYear();
  const first = new Date(yr, mo, 1).getDay();
  const days = new Date(yr, mo+1, 0).getDate();
  cal.innerHTML = '';
  for(let i=0;i<first;i++) cal.appendChild(document.createElement('div'));
  for(let d=1; d<=days; d++){
    const cell = document.createElement('div');
    cell.className='day';
    cell.textContent = d;
    cell.onclick = ()=> {
      const prev = cal.querySelector('.day.sel');
      if (prev) prev.classList.remove('sel');
      if (selDay === d) { selDay = null; }
      else { selDay = d; cell.classList.add('sel'); }
    };
    cal.appendChild(cell);
  }
  document.getElementById('avail-month-label').textContent = `${String(mo+1).padStart(2,'0')}/${yr}`;
}

function pushAdminNotification(title, body, url) {
  const gerente = localStorage.getItem('gerente') || 'admin';
  const key = 'notifications_' + gerente;
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.push({ title, body, url, ts: Date.now() });
  localStorage.setItem(key, JSON.stringify(arr));
  if (Notification && Notification.permission === 'granted') new Notification(title, { body });
}

requestBtn.addEventListener('click', ()=>{
  if (!me) return alert('Faça login como funcionário para solicitar folga aqui.');
  if (!selDay) return alert('Selecione um dia no calendário.');
  const date = new Date(y, m + monthOffset, 1);
  const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  const req = { id: makeId(), type:'off', requester: me, target:null, day: selDay, month: key, status:'pendente', ts: Date.now() };
  const arr = JSON.parse(localStorage.getItem('swap_requests')||'[]');
  arr.push(req);
  localStorage.setItem('swap_requests', JSON.stringify(arr));
  pushAdminNotification('Nova solicitação de folga', `${me} pediu folga em ${selDay}/${key}`, 'swap.html?focus=' + req.id);
  alert('Solicitação enviada ao administrador.');
  const prev = cal.querySelector('.day.sel'); if(prev) prev.classList.remove('sel'); selDay = null;
});

renderCalendarForOffset(monthOffset);
