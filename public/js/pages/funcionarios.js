const form = document.getElementById('form-funcionario');
const lista = document.getElementById('lista-funcionarios');
let funcionarios = JSON.parse(localStorage.getItem('funcionarios')||'[]');

function render() {
  lista.innerHTML='';
  funcionarios.forEach((f,i)=>{
    const li=document.createElement('li');
    li.textContent=`${f.nome} | ${f.telefone} | ${f.setor} | ${f.funcao}`;
    const e=document.createElement('button'); e.textContent='✏️';
    const d=document.createElement('button'); d.textContent='🗑️';
    e.onclick=()=>loadToForm(i);
    d.onclick=()=>{funcionarios.splice(i,1);save();render()};
    li.append(e,d);
    lista.append(li);
  });
}
function save() {
  localStorage.setItem('funcionarios',JSON.stringify(funcionarios));
}
function loadToForm(i){
  const f=funcionarios[i];
  form.idx.value=i;
  form.nome.value=f.nome;
  form.telefone.value=f.telefone;
  form.setor.value=f.setor;
  form.funcao.value=f.funcao;
}
function clearForm(){
  form.reset(); form.idx.value='';
}
form.addEventListener('submit',e=>{
  e.preventDefault();
  const f={ nome:form.nome.value, telefone:form.telefone.value,
            setor:form.setor.value, funcao:form.funcao.value };
  if(form.idx.value==='') funcionarios.push(f);
  else funcionarios[form.idx.value]=f;
  save(); render(); clearForm();
});
render();
