// pages/employee.js
const form = document.getElementById('login-form');

form.addEventListener('submit', e => {
  e.preventDefault();
  const nome    = document.getElementById('nome').value.trim();
  const telefone= document.getElementById('telefone').value.trim();
  const senha   = document.getElementById('senha').value.trim();

  const funcionarios = JSON.parse(localStorage.getItem('funcionarios')||'[]');

  // primeiro: tentar match por nome + telefone (se telefone preenchido)
  let user = null;
  if (telefone) {
    user = funcionarios.find(f => f.nome === nome && (f.telefone === telefone));
  }

  // se não encontrou e senha foi fornecida, tentar nome+senha
  if (!user && senha) {
    user = funcionarios.find(f => f.nome === nome && f.senha === senha);
  }

  // se ainda não encontrou, tentar apenas nome (não recomendado) — rejeitar
  if (!user) return alert('Funcionário não encontrado. Verifique nome/telefone ou senha.');

  // salva sessão
  sessionStorage.setItem('funcionario', user.nome);
  // salva também um token simples para possibilitar "alterar senha" localmente
  sessionStorage.setItem('funcionario_id', user.id || user.nome);
  window.location.href = 'esc_employee.html';
});
