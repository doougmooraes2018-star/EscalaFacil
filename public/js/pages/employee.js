// Employee portal login
const form = document.getElementById('login-form');
form.addEventListener('submit', e => {
  e.preventDefault();
  const nome    = document.getElementById('nome').value.trim();
  const telefone= document.getElementById('telefone').value.trim();
  // busca cadastro
  const funcionarios = JSON.parse(localStorage.getItem('funcionarios')||'[]');
  const user = funcionarios.find(f => f.nome === nome && f.telefone === telefone);
  if (!user) {
    return alert('Funcionário não encontrado. Verifique nome e telefone.');
  }
  // salva sessão
  sessionStorage.setItem('funcionario', nome);
  window.location.href = 'esc_employee.html';
});
