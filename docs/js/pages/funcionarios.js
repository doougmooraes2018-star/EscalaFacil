// funcionarios.js
const form = document.getElementById('form-funcionario');
const lista = document.getElementById('lista-funcionarios');
let funcionarios = JSON.parse(localStorage.getItem('funcionarios')||'[]');

function makeId(){ return 'u-' + Date.now() + '-' + Math.floor(Math.random()*9999); }

function render() {
  lista.innerHTML='';
  funcionarios.forEach((f,i)=>{
    const li=document.createElement('li');
    li.innerHTML = `<div style="display:flex;gap:.5rem;align-items:center;justify-content:space-between">
      <span>${f.nome} — ${f.funcao || f.setor} ${f.senha ? '<small>(senha)</small>' : ''}</span>
      <span>
        <button class="edit">✏️</button>
        <button class="del">🗑️</button>
      </span>
    </div>`;
    const e = li.querySelector('.edit');
    const d = li.querySelector('.del');
    e.onclick = ()=>loadToForm(i);
    d.onclick = ()=>{ if(confirm('Remover funcionário?')) { funcionarios.splice(i,1); save(); render(); } };
    lista.append(li);
  });
}

function save() { localStorage.setItem('funcionarios',JSON.stringify(funcionarios)); }

function loadToForm(i){
  const f=funcionarios[i];
  form.idx.value=i;
  form.nome.value=f.nome;
  form.telefone.value=f.telefone;
  form.setor.value=f.setor;
  form.funcao.value=f.funcao;
  form.senha.value = f.senha || '';
}

function clearForm(){ form.reset(); form.idx.value=''; }

form.addEventListener('submit', e=>{
  e.preventDefault();
  const fObj = {
    nome: form.nome.value.trim(),
    telefone: form.telefone.value.trim(),
    setor: form.setor.value.trim(),
    funcao: form.funcao.value.trim(),
    senha: form.senha.value ? form.senha.value : undefined
  };
  // adiciona id único se não existir
  if (form.idx.value === '') {
    fObj.id = makeId();
    funcionarios.push(fObj);
  } else {
    const idx = Number(form.idx.value);
    fObj.id = funcionarios[idx].id || makeId();
    funcionarios[idx] = fObj;
  }
  save(); render(); clearForm();
});
render();
