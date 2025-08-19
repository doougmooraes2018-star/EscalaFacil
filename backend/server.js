// server.js (MySQL) - cria tabelas automaticamente e expõe API REST
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const app = express();
app.use(helmet());
app.use(express.json());

// Config from env
const DATABASE_URL = process.env.DATABASE_URL || process.env.MYSQL_URL || ''; // ex: mysql://user:pass@host:port/db
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_jwt_secret';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*'; // set e.g. https://douglasmoraesdev.github.io

app.use(cors({ origin: FRONTEND_ORIGIN }));

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set - set env var to MySQL connection string');
  process.exit(1);
}

// parse mysql URL
function parseMysqlUrl(url) {
  // url like mysql://user:pass@host:port/db
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || 3306,
      user: u.username,
      password: u.password,
      database: u.pathname.replace(/^\//,'')
    };
  } catch(err) {
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
      connectionLimit: 10,
      queueLimit: 0,
      // dateStrings: true
    });
  }
  return pool;
}

// --- DB init: create tables if not exists ---
async function initDb() {
  const p = await getPool();
  // users
  await p.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome TEXT NOT NULL,
      telefone VARCHAR(80),
      setor VARCHAR(120),
      funcao VARCHAR(120),
      senha VARCHAR(255),
      role VARCHAR(20) DEFAULT 'employee'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // escala_months
  await p.execute(`
    CREATE TABLE IF NOT EXISTS escala_months (
      month VARCHAR(7) PRIMARY KEY,
      data JSON DEFAULT (JSON_OBJECT())
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // swaps
  await p.execute(`
    CREATE TABLE IF NOT EXISTS swaps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type VARCHAR(10) NOT NULL,
      requester VARCHAR(255),
      \`from\` VARCHAR(255),
      \`to\` VARCHAR(255),
      day INT,
      month VARCHAR(7),
      status VARCHAR(20) DEFAULT 'pendente',
      ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // chat
  await p.execute(`
    CREATE TABLE IF NOT EXISTS chat (
      id INT AUTO_INCREMENT PRIMARY KEY,
      \`user\` VARCHAR(255),
      content TEXT,
      ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // insert admin if missing (senha: 105252)
  const [rows] = await p.execute(`SELECT id FROM users WHERE role='admin' LIMIT 1`);
  if (rows.length === 0) {
    const pass = '105252';
    const hash = await bcrypt.hash(pass, 10);
    await p.execute(
      `INSERT INTO users (nome, telefone, setor, funcao, senha, role) VALUES (?, ?, ?, ?, ?, ?)`,
      ['adm', '', 'gerencia', 'Administrador', hash, 'admin']
    );
    console.log('Admin created: adm / 105252');
  }
}

initDb().catch(err => {
  console.error('DB init failed', err);
  process.exit(1);
});

// --- Helpers JWT/Auth ---
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

async function verifyTokenMiddleware(req,res,next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No auth header' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function adminOnly(req,res,next){
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ error: 'admin only' });
}

// --- Routes ---

// health
app.get('/', (req,res)=> res.json({ ok: true, env: process.env.NODE_ENV || 'dev' }));

// auth: login
app.post('/api/auth/login', async (req,res)=>{
  const { username, password, telefone } = req.body;
  try {
    const p = await getPool();
    // admin login (username === 'adm')
    if (username === 'adm') {
      const [rows] = await p.execute(`SELECT * FROM users WHERE role = 'admin' LIMIT 1`);
      const admin = rows[0];
      if (!admin) return res.status(401).json({ error: 'admin missing' });
      const ok = await bcrypt.compare(password || '', admin.senha || '');
      if (!ok) return res.status(401).json({ error: 'invalid credentials' });
      const token = signToken({ id: admin.id, nome: admin.nome, role: 'admin' });
      return res.json({ token, user: { id: admin.id, nome: admin.nome, role: 'admin' } });
    }
    // employee by nome + telefone
    if (telefone) {
      const [rows] = await p.execute(`SELECT * FROM users WHERE nome = ? AND telefone = ? LIMIT 1`, [username, telefone]);
      const u = rows[0];
      if (!u) return res.status(401).json({ error: 'not found' });
      const token = signToken({ id: u.id, nome: u.nome, role: u.role });
      return res.json({ token, user: { id: u.id, nome: u.nome, role: u.role }});
    }
    // else nome + senha
    const [rows] = await p.execute(`SELECT * FROM users WHERE nome = ? LIMIT 1`, [username]);
    const u = rows[0];
    if (!u) return res.status(401).json({ error: 'not found' });
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
app.get('/api/users', verifyTokenMiddleware, adminOnly, async (req,res)=>{
  const p = await getPool();
  const [rows] = await p.execute(`SELECT id,nome,telefone,setor,funcao,role FROM users ORDER BY nome`);
  res.json(rows);
});

app.post('/api/users', verifyTokenMiddleware, adminOnly, async (req,res)=>{
  const { nome, telefone, setor, funcao, senha, role } = req.body;
  const p = await getPool();
  const hash = senha ? await bcrypt.hash(senha, 10) : null;
  await p.execute(`INSERT INTO users (nome,telefone,setor,funcao,senha,role) VALUES (?, ?, ?, ?, ?, ?)`,
    [nome, telefone, setor, funcao, hash, role || 'employee']);
  res.json({ ok: true });
});

app.put('/api/users/:id', verifyTokenMiddleware, adminOnly, async (req,res)=>{
  const id = Number(req.params.id);
  const { nome, telefone, setor, funcao, senha, role } = req.body;
  const p = await getPool();
  if (senha) {
    const hash = await bcrypt.hash(senha, 10);
    await p.execute(`UPDATE users SET nome=?,telefone=?,setor=?,funcao=?,senha=?,role=? WHERE id = ?`,
      [nome,telefone,setor,funcao,hash,role,id]);
  } else {
    await p.execute(`UPDATE users SET nome=?,telefone=?,setor=?,funcao=?,role=? WHERE id = ?`,
      [nome,telefone,setor,funcao,role,id]);
  }
  res.json({ ok: true });
});

// escala read (any authenticated), write (admin)
app.get('/api/escala/:month', verifyTokenMiddleware, async (req,res)=>{
  const month = req.params.month; // YYYY-MM
  const p = await getPool();
  const [rows] = await p.execute(`SELECT data FROM escala_months WHERE month = ? LIMIT 1`, [month]);
  if (!rows.length) return res.json({});
  res.json(rows[0].data || {});
});

app.put('/api/escala/:month', verifyTokenMiddleware, adminOnly, async (req,res)=>{
  const month = req.params.month;
  const data = req.body || {};
  const p = await getPool();
  await p.execute(`INSERT INTO escala_months (month, data) VALUES (?, ?) 
    ON DUPLICATE KEY UPDATE data = VALUES(data)`, [month, JSON.stringify(data)]);
  res.json({ ok: true });
});

// swaps
app.get('/api/swaps', verifyTokenMiddleware, adminOnly, async (req,res)=>{
  const p = await getPool();
  const [rows] = await p.execute(`SELECT * FROM swaps ORDER BY ts DESC`);
  res.json(rows);
});

app.post('/api/swaps', verifyTokenMiddleware, async (req,res)=>{
  const { type, requester, from, to, day, month } = req.body;
  const p = await getPool();
  const [result] = await p.execute(
    `INSERT INTO swaps (type, requester, \`from\`, \`to\`, day, month, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [type, requester, from, to, day, month, 'pendente']
  );
  const insertId = result.insertId;
  const [rows] = await p.execute(`SELECT * FROM swaps WHERE id = ?`, [insertId]);
  res.json(rows[0]);
});

// approve
app.post('/api/swaps/:id/approve', verifyTokenMiddleware, adminOnly, async (req,res)=>{
  const id = Number(req.params.id);
  const p = await getPool();
  const [r0] = await p.execute(`SELECT * FROM swaps WHERE id = ? LIMIT 1`, [id]);
  if (!r0.length) return res.status(404).json({ error: 'notfound' });
  const s = r0[0];
  // load escala
  const [rEsc] = await p.execute(`SELECT data FROM escala_months WHERE month = ? LIMIT 1`, [s.month]);
  let data = {};
  if (rEsc.length) data = rEsc[0].data || {};
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

// reject
app.post('/api/swaps/:id/reject', verifyTokenMiddleware, adminOnly, async (req,res)=>{
  const id = Number(req.params.id);
  const p = await getPool();
  await p.execute(`UPDATE swaps SET status = ? WHERE id = ?`, ['rejeitado', id]);
  res.json({ ok: true });
});

// chat
app.get('/api/chat', verifyTokenMiddleware, async (req,res)=>{
  const p = await getPool();
  const [rows] = await p.execute(`SELECT * FROM chat ORDER BY ts ASC`);
  res.json(rows);
});

app.post('/api/chat', verifyTokenMiddleware, async (req,res)=>{
  const { content } = req.body;
  const p = await getPool();
  await p.execute(`INSERT INTO chat (\`user\`, content) VALUES (?, ?)`, [req.user.nome, content]);
  res.json({ ok: true });
});

// reports (csv)
app.get('/api/reports/escala_csv', verifyTokenMiddleware, adminOnly, async (req,res)=>{
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

app.get('/api/reports/chat_csv', verifyTokenMiddleware, adminOnly, async (req,res)=>{
  const p = await getPool();
  const [rows] = await p.execute(`SELECT ts, \`user\`, content FROM chat ORDER BY ts ASC`);
  let out = 'ts,user,text\n';
  rows.forEach(r => {
    out += `"${new Date(r.ts).toISOString()}","${(r.user||'')}","${(r.content||'').replace(/"/g,'""')}"\n`;
  });
  res.header('Content-Type','text/csv').send(out);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log('Server running on port', port);
});
