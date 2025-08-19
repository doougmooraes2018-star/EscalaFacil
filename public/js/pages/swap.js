// admin swap approvals
const swapListEl = document.getElementById('swap-list');

if (!sessionStorage.getItem('token')) { alert('Login admin necessário'); location.href = '/'; }

async function loadSwaps(){
  try {
    const r = await apiFetch('/api/swaps');
    if (!r.ok) throw new Error('unauth');
    const rows = await r.json();
    swapListEl.innerHTML = rows.map(s => `
      <li style="padding:.5rem;border-bottom:1px solid #eee">
        <div style="display:flex;justify-content:space-between">
          <div>
            <strong>${s.type}</strong> — requester: ${s.requester || s.from} — dia ${s.day}/${s.month}
            <div style="font-size:.85rem;color:#666">${s.ts}</div>
          </div>
          <div>
            ${s.status === 'pendente' ? `<button onclick="approveSwap(${s.id})">✅</button>
            <button onclick="rejectSwap(${s.id})">❌</button>` : `<strong>${s.status}</strong>`}
          </div>
        </div>
      </li>`).join('');
  } catch (err) {
    swapListEl.innerHTML = '<li>Erro ao carregar solicitações</li>';
  }
}

window.approveSwap = async (id) => {
  if (!confirm('Confirmar aprovação?')) return;
  const r = await apiFetch(`/api/swaps/${id}/approve`, { method: 'POST' });
  if (!r.ok) return alert('Erro aprovar');
  alert('Aprovado');
  loadSwaps();
};
window.rejectSwap = async (id) => {
  if (!confirm('Confirmar rejeição?')) return;
  const r = await apiFetch(`/api/swaps/${id}/reject`, { method: 'POST' });
  if (!r.ok) return alert('Erro rejeitar');
  alert('Rejeitado');
  loadSwaps();
};

loadSwaps();
