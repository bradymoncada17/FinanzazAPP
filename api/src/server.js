'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const sql = require('mssql');

const pbkdf2 = promisify(crypto.pbkdf2);
const port = Number(process.env.PORT || 3000);
const database = process.env.DB_NAME || 'FinanzApp';
const sqlConfig = {
  server: process.env.DB_HOST || 'sqlserver',
  port: Number(process.env.DB_PORT || 1433),
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  database,
  connectionTimeout: 5000,
  requestTimeout: 10000,
  pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
};

// Local-lab defaults only; deploy behind TLS with appropriate secret, proxy, and abuse controls.
const COOKIE_NAME = 'finanzapp_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const PBKDF2_ITERATIONS = 310000;
const PBKDF2_KEY_BYTES = 32;
const DUMMY_SALT = crypto.randomBytes(16);
const DUMMY_HASH = crypto.randomBytes(PBKDF2_KEY_BYTES);
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 12;
const authAttempts = new Map();
let pool;

function sendJson(res, statusCode, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1024 * 1024) throw Object.assign(new Error('El contenido supera 1 MB.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('El cuerpo debe ser JSON válido.'), { statusCode: 400 });
  }
}

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return '';
}

function sessionDigest(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest();
}

function sessionCookie(token) {
  // Secure is intentionally omitted for the local HTTP Docker lab; use TLS for non-local deployment.
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

function clearedSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function validateOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const host = new URL(`http://${req.headers.host || 'localhost'}`).host;
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
    const expectedProtocol = req.socket.encrypted || forwardedProto === 'https' ? 'https:' : 'http:';
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.host === host && parsed.protocol === expectedProtocol && parsed.origin === origin;
  } catch {
    return false;
  }
}

function authRateLimited(req) {
  const now = Date.now();
  const key = req.socket.remoteAddress || 'unknown';
  let entry = authAttempts.get(key);
  if (!entry || now - entry.startedAt >= AUTH_WINDOW_MS) {
    if (!entry && authAttempts.size >= 5000) {
      const oldestKey = authAttempts.keys().next().value;
      if (oldestKey !== undefined) authAttempts.delete(oldestKey);
    }
    entry = { startedAt: now, count: 0 };
    authAttempts.set(key, entry);
  }
  entry.count += 1;
  if (authAttempts.size > 5000) {
    for (const [ip, attempt] of authAttempts) {
      if (now - attempt.startedAt >= AUTH_WINDOW_MS) authAttempts.delete(ip);
    }
  }
  return entry.count > AUTH_MAX_ATTEMPTS;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function safeUser(row) {
  return { id: row.user_id, email: row.email, displayName: row.display_name };
}

async function createSession(transactionOrPool, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const digest = sessionDigest(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await transactionOrPool.request()
    .input('tokenHash', sql.VarBinary(32), digest)
    .input('userId', sql.NVarChar(128), userId)
    .input('expiresAt', sql.DateTime2(3), expiresAt)
    .query('INSERT INTO dbo.app_sessions (token_hash, user_id, expires_at) VALUES (@tokenHash, @userId, @expiresAt)');
  return token;
}

async function findSessionUser(req) {
  const token = getCookie(req, COOKIE_NAME);
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return null;
  const digest = sessionDigest(token);
  const result = await pool.request()
    .input('tokenHash', sql.VarBinary(32), digest)
    .query(`
      SELECT u.user_id, u.email, u.display_name
      FROM dbo.app_sessions AS s
      INNER JOIN dbo.app_users AS u ON u.user_id = s.user_id
      WHERE s.token_hash = @tokenHash AND s.expires_at > SYSUTCDATETIME()
    `);
  if (!result.recordset[0]) {
    await pool.request().input('tokenHash', sql.VarBinary(32), digest)
      .query('DELETE FROM dbo.app_sessions WHERE token_hash = @tokenHash AND expires_at <= SYSUTCDATETIME()');
    return null;
  }
  return safeUser(result.recordset[0]);
}

function badLogin(res) {
  return sendJson(res, 401, { error: 'Correo o contraseña incorrectos.' });
}

async function register(req, res) {
  if (authRateLimited(req)) return sendJson(res, 429, { error: 'Demasiados intentos. Inténtalo más tarde.' });
  const body = await readJson(req);
  const email = normalizeEmail(body && body.email);
  const displayName = typeof (body && body.displayName) === 'string' ? body.displayName.trim() : '';
  const password = body && body.password;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !email ||
      displayName.length < 1 || displayName.length > 80 || /[\u0000-\u001f\u007f]/.test(displayName) ||
      typeof password !== 'string' || password.length < 10 || password.length > 128) {
    return sendJson(res, 400, { error: 'Datos inválidos. Revisa el correo, el nombre (1–80 caracteres) y la contraseña (10–128 caracteres).' });
  }

  const salt = crypto.randomBytes(16);
  const passwordHash = await pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_BYTES, 'sha256');
  const userId = crypto.randomUUID();
  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const count = await transaction.request().query('SELECT COUNT_BIG(*) AS user_count FROM dbo.app_users WITH (UPDLOCK, HOLDLOCK)');
    const isFirstRegisteredUser = BigInt(count.recordset[0].user_count) === 0n;
    await transaction.request()
      .input('userId', sql.NVarChar(128), userId)
      .input('email', sql.NVarChar(254), email)
      .input('displayName', sql.NVarChar(80), displayName)
      .input('passwordSalt', sql.VarBinary(16), salt)
      .input('passwordHash', sql.VarBinary(PBKDF2_KEY_BYTES), passwordHash)
      .input('iterations', sql.Int, PBKDF2_ITERATIONS)
      .query(`
        INSERT INTO dbo.app_users (user_id, email, display_name, password_salt, password_hash, password_iterations)
        VALUES (@userId, @email, @displayName, @passwordSalt, @passwordHash, @iterations)
      `);
    // One-time transactional migration: only the first registered account can claim local_guest.
    if (isFirstRegisteredUser) {
      await transaction.request().input('userId', sql.NVarChar(128), userId)
        .query("UPDATE dbo.financial_snapshots SET user_id = @userId WHERE user_id = N'local_guest'");
    }
    const token = await createSession(transaction, userId);
    await transaction.commit();
    return sendJson(res, 201, { user: { id: userId, email, displayName } }, { 'Set-Cookie': sessionCookie(token) });
  } catch (error) {
    try { await transaction.rollback(); } catch { /* transaction may already have ended */ }
    if (error.number === 2601 || error.number === 2627) {
      return sendJson(res, 409, { error: 'No se pudo crear la cuenta con esos datos.' });
    }
    throw error;
  }
}

async function login(req, res) {
  if (authRateLimited(req)) return sendJson(res, 429, { error: 'Demasiados intentos. Inténtalo más tarde.' });
  const body = await readJson(req);
  const email = normalizeEmail(body && body.email);
  const password = body && body.password;
  if (!email || typeof password !== 'string' || password.length > 128) return badLogin(res);

  const result = await pool.request().input('email', sql.NVarChar(254), email).query(`
    SELECT user_id, email, display_name, password_salt, password_hash, password_iterations
    FROM dbo.app_users WHERE email = @email
  `);
  const row = result.recordset[0];
  const salt = row ? row.password_salt : DUMMY_SALT;
  const expected = row ? row.password_hash : DUMMY_HASH;
  const iterations = row ? row.password_iterations : PBKDF2_ITERATIONS;
  const actual = await pbkdf2(password, salt, iterations, PBKDF2_KEY_BYTES, 'sha256');
  if (!row || !crypto.timingSafeEqual(actual, expected)) return badLogin(res);

  const token = await createSession(pool, row.user_id);
  return sendJson(res, 200, { user: safeUser(row) }, { 'Set-Cookie': sessionCookie(token) });
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    await pool.request().query('SELECT 1 AS ok');
    return sendJson(res, 200, { status: 'ok', database, service: 'finanzapp-api' });
  }

  const authRoute = ['/api/auth/register', '/api/auth/login', '/api/auth/logout'].includes(url.pathname);
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (mutating && (authRoute || url.pathname === '/api/data/all') && !validateOrigin(req)) {
    return sendJson(res, 403, { error: 'Origen no permitido.' });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/register') return register(req, res);
  if (req.method === 'POST' && url.pathname === '/api/auth/login') return login(req, res);
  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const user = await findSessionUser(req);
    return user ? sendJson(res, 200, { user }) : sendJson(res, 401, { error: 'Se requiere iniciar sesión.' });
  }
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = getCookie(req, COOKIE_NAME);
    if (/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
      await pool.request().input('tokenHash', sql.VarBinary(32), sessionDigest(token))
        .query('DELETE FROM dbo.app_sessions WHERE token_hash = @tokenHash');
    }
    return sendJson(res, 200, { loggedOut: true }, { 'Set-Cookie': clearedSessionCookie() });
  }

  if (url.pathname !== '/api/data/all' || !['GET', 'PUT'].includes(req.method)) {
    return sendJson(res, 404, { error: 'Ruta no encontrada.' });
  }

  // Identity is always resolved from the opaque session cookie; client-supplied user headers are ignored.
  const user = await findSessionUser(req);
  if (!user) return sendJson(res, 401, { error: 'Se requiere iniciar sesión.' });
  const userId = user.id;

  if (req.method === 'GET') {
    const result = await pool.request()
      .input('userId', sql.NVarChar(128), userId)
      .input('dataKey', sql.NVarChar(32), 'all')
      .query('SELECT payload, updated_at FROM dbo.financial_snapshots WHERE user_id = @userId AND data_key = @dataKey');
    const row = result.recordset[0];
    return sendJson(res, 200, {
      value: row ? (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) : null,
      updatedAt: row ? row.updated_at : null
    });
  }

  const body = await readJson(req);
  if (!body || typeof body !== 'object' || Array.isArray(body) || !body.payload || typeof body.payload !== 'object') {
    return sendJson(res, 400, { error: 'Se requiere un objeto payload.' });
  }
  const payload = JSON.stringify(body.payload);
  await pool.request()
    .input('userId', sql.NVarChar(128), userId)
    .input('dataKey', sql.NVarChar(32), 'all')
    .input('payload', sql.NVarChar(sql.MAX), payload)
    .query(`
      MERGE dbo.financial_snapshots WITH (HOLDLOCK) AS target
      USING (SELECT @userId AS user_id, @dataKey AS data_key) AS source
      ON target.user_id = source.user_id AND target.data_key = source.data_key
      WHEN MATCHED THEN UPDATE SET payload = @payload, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (user_id, data_key, payload)
        VALUES (@userId, @dataKey, @payload);
    `);
  return sendJson(res, 200, { saved: true, userId, updatedAt: new Date().toISOString() });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error('[API]', error.code || error.message);
    if (res.headersSent) return res.destroy();
    const status = error.statusCode || (error.code === 'EREQUEST' ? 500 : 503);
    sendJson(res, status, { error: status === 500 ? 'Error al consultar SQL Server.' : error.message });
  });
});

async function start() {
  pool = await new sql.ConnectionPool(sqlConfig).connect();
  server.listen(port, '0.0.0.0', () => console.log(`API escuchando en el puerto ${port}; SQL Server: ${sqlConfig.server}/${database}`));
}

start().catch((error) => {
  console.error('[API] No fue posible conectar con SQL Server:', error.code || error.message);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    server.close();
    if (pool) await pool.close();
    process.exit(0);
  });
}
