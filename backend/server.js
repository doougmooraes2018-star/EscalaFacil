// server.js - backend + serves frontend from ../public (corrigido)
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const path = require('path');

require('dotenv').config(); // optional: if you create .env locally

const app = express();
// desativa a CSP padrão do helmet e cria uma configuração controlada
app.use(helmet({
  contentSecurityPolicy: false
}));

// CSP customizada — inclui o hash do script inline (substitua pelo seu hash se necessário)
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'sha256-DDdM2eJqgOtU3SY8+Q68rUBgSebfcW23cX5u8Hg6cyc='"],
    styleSrc: ["'self'", "'unsafe-inline'"], // se você tiver <style> inline ou CSS inlined
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'", "ws:", "http:", "https:"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    frameAncestors: ["'none'"]
  }
}));

app.use(express.json());
app.use(morgan('tiny'));

const DATABASE_URL = process.env.DATABASE_URL || '';
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_jwt_secret';
const PORT = process.env.PORT || 3000;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Please set environment variable.');
  process.exit(1);
}

function parseMysqlUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || 3306,
      user: u.username,
      password: u.password,
      database: u.pathname.replace(/^\//, '')
    };
  } catch (err) {
    throw new Error('Invalid DATABASE_URL: ' + err.message);
  }
}

const cfg = parseMysqlUrl(DATABASE_URL);

let pool;
async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      waitForConnections: true,
      connectionLimit: 10
    });
  }
  return pool;
}

// Initialize DB (create tables) on startup
async function initDb() {
  const p = await getPool();

  await p.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      telefone VARCHAR(80),
      setor VARCHAR(120),
      funcao VARCHAR(120),
      senha VARCHAR(255),
      role VARCHAR(20) DEFAULT 'employee',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS escala_months (
      month VARCHAR(7) PRIMARY KEY,
      data JSON
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS swaps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      requester VARCHAR(255),
      ` + "`from` VARCHAR(255)," + `
      ` + "`to` VARCHAR(255)," + `
      day INT,
      month VARCHAR(7),
      status VARCHAR(20) DEFAULT 'pendente',
      ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await p.execute(`
    CREATE TABLE IF NOT EXISTS chat (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ` + "`user` VARCHAR(255)," + `
      content TEXT,
      ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // ensure admin exists (adm / 105252)
  const [rows] = await p.execute(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (!rows || rows.length === 0) {
    const hash = await bcrypt.hash('105252', 10);
    await p.execute(
      `INSERT INTO users (nome, telefone, setor, funcao, senha, role) VALUES (?, ?, ?, ?, ?, ?)`,
      ['adm', '', 'gerencia', 'Administrador', hash, 'admin']
    );
    console.log('Admin created: adm / 105252');
  }
}

initDb().catch(err => {
  console.error('DB init error', err);
  process.exit(1);
});

// --- auth & helpers ---
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

async function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'no auth header' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'invalid token' });
  }
}

function adminOnly(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'admin only' });
}

// --- API routes ---

// health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// auth/login
app.post('/api/auth/login', async (req, res) => {
  const { username, password, telefone } = req.body;
  try {
    const p = await getPool();
    // admin quick login by username 'adm'
    if (username === 'adm' && password) {
      const [rows] = await p.execute(`SELECT * FROM users WHERE role='admin' LIMIT 1`);
      const admin = rows[0];
      if (!admin) return res.status(401).json({ error: 'admin missing' });
      const ok = await bcrypt.compare(password, admin.senha || '');
      if (!ok) return res.status(401).json({ error: 'invalid credentials' });
      const token = signToken({ id: admin.id, nome: admin.nome, role: 'admin' });
      return res.json({ token, user: { id: admin.id, nome: admin.nome, role: admin.role }});
    }

    if (telefone) {
      const [rows] = await p.execute(`SELECT * FROM users WHERE nome = ? AND telefone = ? LIMIT 1`, [username, telefone]);
      if (!rows || !rows[0]) return res.status(401).json({ error: 'not found' });
      const u = rows[0];
      const token = signToken({ id: u.id, nome: u.nome, role: u.role });
      return res.json({ token, user: { id: u.id, nome: u.nome, role: u.role }});
    }

    // name+password
    const [rows] = await p.execute(`SELECT * FROM users WHERE nome = ? LIMIT 1`, [username]);
    if (!rows || !rows[0]) return res.status(401).json({ error: 'not found' });
    const u = rows[0];
    if (!u.senha) return res.status(401).json({ error: 'no password set; use telefone' });
    const ok = await bcrypt.compare(password || '', u.senha);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    const token = signToken({ id: u.id, nome: u.nome, role: u.role });
    return res.json({ token, user: { id: u.id, nome: u.nome, role: u.role }});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// users (admin)
app.get('/api/users', verifyToken, adminOnly, async (req, res) => {
  const p = await getPool();
  const [rows] = await p.execute(`SELECT id,nome,telefone,setor,funcao,role FROM users ORDER BY nome`);
  res.json(rows);
});

app.post('/api/users', verifyToken, adminOnly, async (req, res) => {
  const { nome, telefone, setor, funcao, senha, role } = req.body;
  const p = await getPool();
  const hash = senha ? await bcrypt.hash(senha, 10) : null;
  await p.execute(`INSERT INTO users (nome,telefone,setor,funcao,senha,role) VALUES (?, ?, ?, ?, ?, ?)`,
    [nome, telefone || '', setor || '', funcao || '', hash, role || 'employee']);
  res.json({ ok: true });
});

app.put('/api/users/:id', verifyToken, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const { nome, telefone, setor, funcao, senha, role } = req.body;
  const p = await getPool();
  if (senha) {
    const hash = await bcrypt.hash(senha, 10);
    await p.execute(`UPDATE users SET nome=?,telefone=?,setor=?,funcao=?,senha=?,role=? WHERE id = ?`,
      [nome, telefone || '', setor || '', funcao || '', hash, role || 'employee', id]);
  } else {
    await p.execute(`UPDATE users SET nome=?,telefone=?,setor=?,funcao=?,role=? WHERE id = ?`,
      [nome, telefone || '', setor || '', funcao || '', role || 'employee', id]);
  }
  res.json({ ok: true });
});

// self change password
app.put('/api/users/:id/self', verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  if (req.user.id !== id && req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden' });
  const { oldPassword, newPassword } = req.body;
  const p = await getPool();
  const [rows] = await p.execute(`SELECT * FROM users WHERE id = ? LIMIT 1`, [id]);
  const u = rows[0];
  if (!u) return res.status(404).json({ error: 'not found' });
  if (req.user.role !== 'admin') {
    const ok = await bcrypt.compare(oldPassword || '', u.senha || '');
    if (!ok) return res.status(400).json({ error: 'invalid current password' });
  }
  const hash = await bcrypt.hash(newPassword, 10);
  await p.execute(`UPDATE users SET senha = ? WHERE id = ?`, [hash, id]);
  res.json({ ok: true });
});

// escala read/write
app.get('/api/escala/:month', verifyToken, async (req, res) => {
  const month = req.params.month;
  const p = await getPool();
  const [rows] = await p.execute(`SELECT data FROM escala_months WHERE month = ? LIMIT 1`, [month]);
  if (!rows || rows.length === 0) return res.json({});
  res.json(rows[0].data || {});
});

app.put('/api/escala/:month', verifyToken, adminOnly, async (req, res) => {
  const month = req.params.month;
  const data = req.body || {};
  const p = await getPool();
  await p.execute(`INSERT INTO escala_months (month, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)`,
    [month, JSON.stringify(data)]);
  res.json({ ok: true });
});

// swaps
app.get('/api/swaps', verifyToken, adminOnly, async (req, res) => {
  const p = await getPool();
  const [rows] = await p.execute(`SELECT * FROM swaps ORDER BY ts DESC`);
  res.json(rows);
});

app.post('/api/swaps', verifyToken, async (req, res) => {
  const { type, requester, from, to, day, month } = req.body;
  const p = await getPool();
  const [result] = await p.execute(
    `INSERT INTO swaps (type, requester, ` + "`from` , `to`" + `, day, month, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [type, requester, from, to, day, month, 'pendente']
  );
  const insertId = result.insertId;
  const [rows] = await p.execute(`SELECT * FROM swaps WHERE id = ?`, [insertId]);
  res.json(rows[0]);
});

app.post('/api/swaps/:id/approve', verifyToken, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const p = await getPool();
  const [r0] = await p.execute(`SELECT * FROM swaps WHERE id = ? LIMIT 1`, [id]);
  if (!r0 || !r0.length) return res.status(404).json({ error: 'notfound' });
  const s = r0[0];
  const [rEsc] = await p.execute(`SELECT data FROM escala_months WHERE month = ? LIMIT 1`, [s.month]);
  let data = {};
  if (rEsc && rEsc.length) data = rEsc[0].data || {};
  if (s.type === 'off') {
    data[s.day] = data[s.day] || [];
    if (!data[s.day].includes(s.requester)) data[s.day].push(s.requester);
  } else {
    data[s.day] = (data[s.day] || []).filter(n => n !== (s.from || s.requester));
    if (!data[s.day].includes(s.to)) data[s.day].push(s.to);
  }
  await p.execute(`INSERT INTO escala_months (month, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data)`,
    [s.month, JSON.stringify(data)]);
  await p.execute(`UPDATE swaps SET status = ? WHERE id = ?`, ['aprovado', id]);
  res.json({ ok: true });
});

app.post('/api/swaps/:id/reject', verifyToken, adminOnly, async (req, res) => {
  const id = Number(req.params.id);
  const p = await getPool();
  await p.execute(`UPDATE swaps SET status = ? WHERE id = ?`, ['rejeitado', id]);
  res.json({ ok: true });
});

// chat
app.get('/api/chat', verifyToken, async (req, res) => {
  const p = await getPool();
  const [rows] = await p.execute(`SELECT * FROM chat ORDER BY ts ASC`);
  res.json(rows);
});

app.post('/api/chat', verifyToken, async (req, res) => {
  const { content } = req.body;
  const p = await getPool();
  await p.execute(`INSERT INTO chat (` + "`user` , content) VALUES (?, ?)", [req.user.nome, content]);
  res.json({ ok: true });
});

// reports
app.get('/api/reports/escala_csv', verifyToken, adminOnly, async (req, res) => {
  const p = await getPool();
  const [rows] = await p.execute(`SELECT month, data FROM escala_months ORDER BY month DESC`);
  let out = 'month,day,employees\n';
  for (const row of rows) {
    const data = row.data || {};
    Object.keys(data).sort((a,b)=>a-b).forEach(d => {
      out += `"${row.month}","${d}","${(data[d]||[]).join('; ')}"\n`;
    });
  }
  res.header('Content-Type','text/csv').send(out);
});

app.get('/api/reports/chat_csv', verifyToken, adminOnly, async (req, res) => {
  const p = await getPool();
  const [rows] = await p.execute(`SELECT ts, ` + "`user` , content FROM chat ORDER BY ts ASC");
  let out = 'ts,user,text\n';
  rows.forEach(r => {
    out += `"${new Date(r.ts).toISOString()}","${(r.user||'')}","${(r.content||'').replace(/"/g,'""')}"\n`;
  });
  res.header('Content-Type','text/csv').send(out);
});

// serve static frontend (public) — CORREÇÃO: usar pasta parent ../public
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
