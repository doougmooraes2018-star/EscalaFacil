const btnEscalaCsv = document.getElementById('export-escala');
const btnChatCsv = document.getElementById('export-chat');

if (btnEscalaCsv) btnEscalaCsv.addEventListener('click', async ()=>{
  const r = await apiFetch('/api/reports/escala_csv');
  if (!r.ok) return alert('Erro gerar relatório (verifique autenticação)');
  const blob = await r.blob();
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'escala_all.csv'; a.click(); URL.revokeObjectURL(a.href);
});

if (btnChatCsv) btnChatCsv.addEventListener('click', async ()=>{
  const r = await apiFetch('/api/reports/chat_csv');
  if (!r.ok) return alert('Erro gerar chat');
  const blob = await r.blob();
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'chat_history.csv'; a.click(); URL.revokeObjectURL(a.href);
});
