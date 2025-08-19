// fixtures.js - execute no Console para popular dados de teste
localStorage.setItem('funcionarios', JSON.stringify([
  { nome: 'João Silva', telefone: '11999990000', setor: 'Loja', funcao: 'Caixa' },
  { nome: 'Maria Souza', telefone: '11988880000', setor: 'Cozinha', funcao: 'Cozinheira' },
  { nome: 'Ana Pereira', telefone: '11977770000', setor: 'Atendimento', funcao: 'Atendente' },
  { nome: 'Carlos Lima', telefone: '11966660000', setor: 'Gerência', funcao: 'Gerente' }
]));
localStorage.setItem('escala_2025-08', JSON.stringify({
  "1": ["João Silva","Maria Souza"],
  "2": ["Ana Pereira"],
  "3": ["Carlos Lima","João Silva"],
  "5": ["Maria Souza"]
}));
localStorage.setItem('swap_requests', JSON.stringify([]));
localStorage.setItem('chat_messages', JSON.stringify([]));
alert('Fixtures criados. Use sessionStorage.setItem(\"funcionario\",\"João Silva\") para logar como teste.');
