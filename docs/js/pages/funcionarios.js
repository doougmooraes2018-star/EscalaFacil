// docs/js/pages/funcionarios.js
const form = document.getElementById('form-funcionario');
const lista = document.getElementById('lista-funcionarios');
let token = sessionStorage.getItem('token');
if (!token) { alert('Login admin necessário.'); window.location.href='index.html'; }

async function loadList(){
  try {
    const r = await apiFetch('/api/users');
    if (!r.ok) throw new Error('unauthorized');
    const funcs = await r.json();
    render(funcs);
    localStorage.setItem('funcionarios', JSON.stringify(funcs));
  } catch (err) {
    // fallback to localStorage
    const funcs = JSON.parse(localStorage.getItem('funcionarios') || '[]');
    render(funcs);
  }
}

function render(funcs){
  lista.innerHTML = '';
  funcs.forEach((f,i)=>{
    const li = document.createElement('li');
    li.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div>${f.nome} | ${f.telefone || ''} | ${f.setor || ''} | ${f.funcao || ''}</div>
      <div>
        <button class="btn-edit" data-id="${f.id}">✏️</button>
        <button class="btn-del" data-id="${f.id}">🗑️</button>
      </div>
    </div>`;
    lista.appendChild(li);
  });
  // attach events
  Array.from(document.querySelectorAll('.btn-edit')).forEach(b=>{
    b.addEventListener('click', async e=>{
      const id = b.dataset.id;
      // load single user (we can fetch list again and find)
      const r = await apiFetch('/api/users');
      if (!r.ok) return alert('erro');
      const funcs = await r.json();
      const u = funcs.find(x=>String(x.id) === String(id));
      if (!u) return alert('usuario nao encontrado');
      form.idx.value = u.id;
      form.nome.value = u.nome;
      form.telefone.value = u.telefone || '';
      form.setor.value = u.setor || '';
      form.funcao.value = u.funcao || '';
    });
  });
  Array.from(document.querySelectorAll('.btn-del')).forEach(b=>{
    b.addEventListener('click', async ()=> {
      if (!confirm('Remover funcionario?')) return;
      const id = b.dataset.id;
      try {
        // backend doesn't have delete in our API; we will simulate by updating role=deleted if needed.
        // For now we remove from local view and ask admin to implement delete if desired.
        alert('Remoção via API não implementada; edite manualmente no banco ou implemente endpoint DELETE /api/users/:id.');
      } catch (err) { alert('Erro ao deletar'); }
    });
  });
}

form.addEventListener('submit', async e=>{
  e.preventDefault();
  const idx = form.idx.value;
  const payload = {
    nome: form.nome.value.trim(),
    telefone: form.telefone.value.trim(),
    setor: form.setor.value.trim(),
    funcao: form.funcao.value.trim(),
    senha: form.senha ? form.senha.value : undefined
  };
  try {
    if (!payload.nome) return alert('Nome requerido');
    if (!idx) {
      const r = await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(payload) });
      if (!r.ok) { const j = await r.json(); return alert(j.error||'Erro criar'); }
      alert('Funcionário criado');
    } else {
      const r = await apiFetch(`/api/users/${idx}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (!r.ok) { const j = await r.json(); return alert(j.error||'Erro atualizar'); }
      alert('Atualizado');
    }
    form.reset(); form.idx.value='';
    loadList();
  } catch (err) { console.error(err); alert('Erro de rede'); }
});

loadList();
