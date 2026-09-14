require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
app.use(cookieSession({
  name: 'gstours_session',
  keys: [process.env.SESSION_SECRET || 'change-this-in-production'],
  maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
}));

const ENTITIES = ['companies', 'vendors', 'contacts', 'queries', 'bookings', 'invoices'];

// --- auth -------------------------------------------------------------
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Not signed in' });
  next();
}

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  req.session.userId = user.id;
  res.json({ id: user.id, email: user.email, name: user.name });
});

app.post('/api/auth/logout', (req, res) => { req.session = null; res.json({ ok: true }); });

app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.userId) return res.json(null);
  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(req.session.userId);
  res.json(user || null);
});

app.get('/api/auth/status', (req, res) => {
  const { n } = db.prepare('SELECT COUNT(*) as n FROM users').get();
  res.json({ hasUsers: n > 0 });
});

// One-time setup: create the first user if none exist yet. Locks itself
// once a user exists, so it can't be used to add unauthorized accounts.
app.post('/api/auth/setup', (req, res) => {
  const existing = db.prepare('SELECT COUNT(*) as n FROM users').get();
  if (existing.n > 0) return res.status(403).json({ error: 'Setup already completed' });
  const { email, password, name } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and an 8+ character password are required' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (email, passwordHash, name) VALUES (?, ?, ?)')
    .run(String(email).toLowerCase().trim(), hash, name || '');
  req.session.userId = info.lastInsertRowid;
  res.json({ id: info.lastInsertRowid, email, name });
});

app.use('/api/companies', requireAuth);
app.use('/api/vendors', requireAuth);
app.use('/api/contacts', requireAuth);
app.use('/api/queries', requireAuth);
app.use('/api/bookings', requireAuth);
app.use('/api/invoices', requireAuth);
app.use('/api/settings', requireAuth);
app.use('/api/meta', requireAuth);

// --- generic entity CRUD ------------------------------------------------
// Every entity (companies, vendors, contacts, queries, bookings, invoices)
// stores its full record as a JSON blob plus a couple of denormalized
// columns for filtering. This mirrors exactly how the CRM already shapes
// its data, so the frontend barely has to change.
function registerEntity(name, extraCols) {
  app.get(`/api/${name}`, (req, res) => {
    const rows = db.prepare(`SELECT data FROM ${name}`).all();
    res.json(rows.map(r => JSON.parse(r.data)));
  });

  app.put(`/api/${name}/:id`, (req, res) => {
    const record = req.body;
    if (!record || record.id !== req.params.id) return res.status(400).json({ error: 'Record id mismatch' });
    const cols = ['id', 'data', ...extraCols.map(c => c.col)];
    const placeholders = cols.map(() => '?').join(', ');
    const updates = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ');
    const values = [record.id, JSON.stringify(record), ...extraCols.map(c => c.value(record))];
    db.prepare(`
      INSERT INTO ${name} (${cols.join(', ')}, updatedAt)
      VALUES (${placeholders}, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET ${updates}, updatedAt = datetime('now')
    `).run(...values);
    db.prepare('INSERT INTO audit_log (entity, entityId, action, snapshot) VALUES (?, ?, ?, ?)')
      .run(name, record.id, 'upsert', JSON.stringify(record));
    res.json(record);
  });

  app.delete(`/api/${name}/:id`, (req, res) => {
    db.prepare(`DELETE FROM ${name} WHERE id = ?`).run(req.params.id);
    db.prepare('INSERT INTO audit_log (entity, entityId, action, snapshot) VALUES (?, ?, ?, ?)')
      .run(name, req.params.id, 'delete', null);
    res.json({ ok: true });
  });
}

registerEntity('companies', [{ col: 'name', value: r => r.name || '' }]);
registerEntity('vendors', [{ col: 'name', value: r => r.name || '' }]);
registerEntity('contacts', [{ col: 'name', value: r => r.name || '' }]);
registerEntity('queries', [
  { col: 'ref', value: r => r.ref || '' },
  { col: 'company', value: r => r.company || '' },
  { col: 'stage', value: r => r.stage || '' }
]);
registerEntity('bookings', [
  { col: 'ref', value: r => r.ref || '' },
  { col: 'company', value: r => r.company || '' },
  { col: 'status', value: r => r.status || '' },
  { col: 'tripDate', value: r => r.tripDate || '' }
]);
registerEntity('invoices', [
  { col: 'number', value: r => r.number || '' },
  { col: 'company', value: r => r.company || '' },
  { col: 'status', value: r => r.status || '' }
]);

// --- singletons: settings and meta (numbering sequences) ---------------
app.get('/api/settings', (req, res) => {
  const row = db.prepare('SELECT data FROM settings WHERE id = 1').get();
  res.json(row ? JSON.parse(row.data) : null);
});
app.put('/api/settings', (req, res) => {
  db.prepare(`
    INSERT INTO settings (id, data, updatedAt) VALUES (1, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = datetime('now')
  `).run(JSON.stringify(req.body));
  res.json(req.body);
});

app.get('/api/meta', (req, res) => {
  const row = db.prepare('SELECT data FROM meta WHERE id = 1').get();
  res.json(row ? JSON.parse(row.data) : { qSeq: 0, bSeq: 0 });
});
app.put('/api/meta', (req, res) => {
  db.prepare(`
    INSERT INTO meta (id, data, updatedAt) VALUES (1, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = datetime('now')
  `).run(JSON.stringify(req.body));
  res.json(req.body);
});

// --- full snapshot, for backup / restore parity with the old app -------
app.get('/api/backup', (req, res) => {
  const out = {};
  ENTITIES.forEach(name => {
    out[name] = db.prepare(`SELECT data FROM ${name}`).all().map(r => JSON.parse(r.data));
  });
  const settingsRow = db.prepare('SELECT data FROM settings WHERE id = 1').get();
  const metaRow = db.prepare('SELECT data FROM meta WHERE id = 1').get();
  out.settings = settingsRow ? JSON.parse(settingsRow.data) : {};
  out.meta = metaRow ? JSON.parse(metaRow.data) : { qSeq: 0, bSeq: 0 };
  res.json(out);
});

app.post('/api/restore', (req, res) => {
  const incoming = req.body;
  // node:sqlite has no .transaction() helper, so BEGIN/COMMIT/ROLLBACK are
  // run explicitly — same all-or-nothing guarantee, just spelled out.
  db.exec('BEGIN');
  try {
    ENTITIES.forEach(name => {
      (incoming[name] || []).forEach(record => {
        if (!record.id) return;
        db.prepare(`
          INSERT INTO ${name} (id, data, updatedAt) VALUES (?, ?, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = datetime('now')
        `).run(record.id, JSON.stringify(record));
      });
    });
    if (incoming.settings) {
      db.prepare(`
        INSERT INTO settings (id, data, updatedAt) VALUES (1, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = datetime('now')
      `).run(JSON.stringify(incoming.settings));
    }
    if (incoming.meta) {
      db.prepare(`
        INSERT INTO meta (id, data, updatedAt) VALUES (1, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updatedAt = datetime('now')
      `).run(JSON.stringify(incoming.meta));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'Restore failed, nothing was changed: ' + err.message });
  }
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Serve the built React app (npm run build in ../client outputs here). Any
// route that isn't /api/* falls through to index.html, so client-side
// routing (if any is added later) keeps working on a hard refresh.
const path = require('path');
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend not built yet — run `npm run build` in the client folder.');
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`GS Tours CRM backend listening on :${PORT}`));

module.exports = app;
