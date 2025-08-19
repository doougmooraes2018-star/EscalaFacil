// login funcionário
const form = document.getElementById('login-form');
form.addEventListener('submit', async e => {
  e.preventDefault();
  const nome = document.getElementById('nome').value.trim();
  const telefone = document.getElementById('telefone').value.trim();
  const senha = document.getElementById('senha').value.trim();

  const payload = telefone ? { username: nome, telefone } : { username: nome, password: senha };

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await res.json();
    if (!res.ok) return alert(j.error || 'Erro no login');
    sessionStorage.setItem('token', j.token);
    sessionStorage.setItem('funcionario', j.user.nome);
    sessionStorage.setItem('funcionario_id', j.user.id);
    window.location.href = 'esc_employee.html';
  } catch (err) {
    console.error(err);
    alert('Erro de rede');
  }
});
