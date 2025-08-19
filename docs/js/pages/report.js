// report.js
const exportAllBtn = document.getElementById('export-all-scales');
const exportChatBtn = document.getElementById('export-chat');
const exportSwapsBtn = document.getElementById('export-swaps');
const msgEl = document.getElementById('report-msg');

function downloadBlob(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

exportAllBtn.addEventListener('click', () => {
  const escKeys = Object.keys(localStorage).filter(k => k.startsWith('escala_'));
  if (escKeys.length === 0) return msgEl.textContent = 'Nenhuma escala encontrada.';
  const rows = [['month','day','employees']];
  escKeys.forEach(k => {
    const key = k.slice(7);
    const data = JSON.parse(localStorage.getItem(k) || '{}');
    Object.keys(data).sort((a,b)=>a-b).forEach(d => rows.push([key, d, data[d].join('; ')]));
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadBlob('escala_all.csv', csv);
  msgEl.textContent = 'Exportado escala_all.csv';
});

exportChatBtn.addEventListener('click', () => {
  const chat = JSON.parse(localStorage.getItem('chat_messages') || '[]');
  if (!chat.length) return msgEl.textContent = 'Sem mensagens no chat.';
  const rows = [['ts','user','text'], ...chat.map(m => [new Date(m.ts).toISOString(), m.user, m.text])];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadBlob('chat_history.csv', csv);
  msgEl.textContent = 'Exportado chat_history.csv';
});

exportSwapsBtn.addEventListener('click', () => {
  const swaps = JSON.parse(localStorage.getItem('swap_requests') || '[]');
  if (!swaps.length) return msgEl.textContent = 'Sem solicitações.';
  const rows = [['id','type','requester','target','day','month','status','ts'], ...swaps.map(s => [
    s.id, s.type, s.requester || s.from, s.target || s.to || '', s.day, s.month, s.status, new Date(s.ts).toISOString()
  ])];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadBlob('swap_requests.csv', csv);
  msgEl.textContent = 'Exportado swap_requests.csv';
});
