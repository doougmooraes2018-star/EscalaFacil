#!/usr/bin/env node
/**
 * init_db.js
 *  - Conecta ao MySQL usando process.env.DATABASE_URL (ou --database-url)
 *  - Cria as tabelas necessárias se não existirem
 *  - Garante a existência do usuário admin (adm / 105252) com senha hash
 *  - Usa retry/backoff para esperar o banco ficar disponível
 *
 * Uso:
 *   # no Railway Run (variáveis de ambiente já definidas):
 *   node init_db.js
 *
 *   # local (exemplo):
 *   DATABASE_URL="mysql://root:pass@host:3306/db" node init_db.js
 *
 * Obs: requer dependências: mysql2, bcrypt
 *   npm install mysql2 bcrypt
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

function parseMysqlUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port ? Number(u.port) : 3306,
      user: u.username,
      password: u.password,
      database: u.pathname.replace(/^\//, '')
    };
  } catch (err) {
    throw new Error('DATABASE_URL inválida: ' + err.message);
  }
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

async function runInit(opts = {}) {
  const envUrl = process.env.DATABASE_URL;
  const cliUrl = (process.argv.find(a => a.startsWith('--database-url=')) || '').split('=')[1];
  const url = cliUrl || envUrl || opts.databaseUrl;
  if (!url) {
    console.error('ERRO: DATABASE_URL não encontrada. Defina a env var DATABASE_URL ou use --database-url=');
    process.exit(2);
  }

  const cfg = parseMysqlUrl(url);

  const maxAttempts = opts.retries || 8;
  const baseDelay = opts.baseDelayMs || 2000;

  let pool;
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[init_db] Tentativa ${attempt}/${maxAttempts} — conectando ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database} ...`);
      pool = mysql.createPool({
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
        waitForConnections: true,
        connectionLimit: 5,
        connectTimeout: 10000
      });

      // teste simples
      const [ping] = await pool.query('SELECT 1+1 AS v');
      if (!ping || !ping.length) throw new Error('ping falhou');

      console.log('[init_db] Conexão OK. Executando DDLs...');

      const ddls = [
`CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  telefone VARCHAR(80),
  setor VARCHAR(120),
  funcao VARCHAR(120),
  senha VARCHAR(255),
  role VARCHAR(20) DEFAULT 'employee',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

`CREATE TABLE IF NOT EXISTS escala_months (
  month VARCHAR(7) PRIMARY KEY,
  data JSON
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

`CREATE TABLE IF NOT EXISTS swaps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(20) NOT NULL,
  requester VARCHAR(255),
  \`from\` VARCHAR(255),
  \`to\` VARCHAR(255),
  day INT,
  month VARCHAR(7),
  status VARCHAR(20) DEFAULT 'pendente',
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

`CREATE TABLE IF NOT EXISTS chat (
  id INT AUTO_INCREMENT PRIMARY KEY,
  \`user\` VARCHAR(255),
  content TEXT,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
      ];

      for (const s of ddls) {
        console.log('[init_db] Executando DDL...');
        await pool.query(s);
      }

      console.log('[init_db] DDLs executadas. Verificando admin...');

      const [rows] = await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      if (!rows || rows.length === 0) {
        const plainPass = '105252';
        const hash = await bcrypt.hash(plainPass, 10);
        await pool.query("INSERT INTO users (nome, telefone, setor, funcao, senha, role) VALUES (?, ?, ?, ?, ?, ?)",
          ['adm', '', 'gerencia', 'Administrador', hash, 'admin']);
        console.log('[init_db] Admin criado: adm / 105252');
      } else {
        console.log('[init_db] Admin já existe (não será recriado).');
      }

      // Mostrar tabelas existentes (resumo)
      const [tables] = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name", [cfg.database]);
      console.log('[init_db] Tabelas no schema:', tables.map(r => r.table_name).join(', '));

      // OK
      await pool.end().catch(()=>{});
      console.log('[init_db] Concluído com sucesso.');
      process.exit(0);
    } catch (err) {
      lastErr = err;
      console.error(`[init_db] Erro na tentativa ${attempt}:`, err && err.message ? err.message : err);
      if (pool) {
        try { await pool.end(); } catch(e){}
        pool = null;
      }
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(1.5, attempt - 1); // backoff exponencial leve
        console.log(`[init_db] Aguardando ${Math.round(delay)}ms antes da próxima tentativa...`);
        await sleep(delay);
      } else {
        console.error('[init_db] Ultrapassou número máximo de tentativas. Abortando.');
      }
    }
  }

  console.error('[init_db] Falha final:', lastErr && lastErr.message ? lastErr.message : lastErr);
  process.exit(3);
}

runInit().catch(e => {
  console.error('[init_db] Unhandled error:', e && e.message ? e.message : e);
  process.exit(99);
});
