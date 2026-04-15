require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// ── DATABASE INITIALIZATION PROMISE ──
let dbInitPromise = null;
const ensureDb = async () => {
    if (!dbInitPromise) dbInitPromise = db.init();
    return dbInitPromise;
};
// ──────────────────────────────────────

app.use(cors());
app.use(express.json());

// Middleware untuk mengekstrak info Admin dari header (untuk Audit Trail)
app.use((req, res, next) => {
    // Log incoming request for debugging
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    req.admin = {
        id: req.headers['x-admin-id'] || 'system',
        name: req.headers['x-admin-name'] || 'System',
        role: req.headers['x-admin-role'] || 'admin'
    };
    next();
});

// Middleware untuk memastikan DB siap sebelum request diproses
app.use(async (req, res, next) => {
    try {
        await ensureDb();
        next();
    } catch (e) {
        res.status(500).json({ status: 'error', message: 'Database initialization failed: ' + e.message });
    }
});

// ── HEALTH CHECK ─────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    res.json({ status: 'ok', db: 'postgres', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

app.get('/api/ping', async (req, res) => {
  res.json({ status: 'ok' });
});

// ── AUTH ─────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = await db.validateAdmin(username, password);
    if (user) {
      return res.json({ ok: true, id: user.id, username: user.username, role: user.role });
    }
    res.status(401).json({ ok: false, error: 'Username atau password salah' });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Koneksi database gagal: ' + e.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    if (!username || !password) return res.status(400).json({ ok: false, error: 'Username dan password wajib diisi' });
    const user = await db.registerAdmin(username, password, role);
    res.json({ ok: true, user });
  } catch (e) {
    if (e.message.includes('unique constraint')) return res.status(400).json({ ok: false, error: 'Username sudah digunakan' });
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/auth/change-password', async (req, res) => {
  const { oldPassword, newPassword, username } = req.body || {};
  // Update both settings table (for legacy/display) and admins table (for auth)
  await db.updateSetting('login_password', newPassword);
  if (username) {
    await db.updateAdminPassword(username, newPassword);
  } else {
    // If username not provided, try to update 'admin' default account
    await db.updateAdminPassword('admin', newPassword);
  }
  res.json({ ok: true });
});

// ── ADMIN MANAGEMENT ─────────────────────────────────────────
app.get('/api/admins', async (req, res) => {
  try {
    res.json(await db.getAdmins());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/admins/:id', async (req, res) => {
  try {
    const ok = await db.updateAdmin(req.params.id, req.body);
    res.json({ ok });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admins/:id', async (req, res) => {
  try {
    await db.deleteAdmin(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── AUDIT LOGS ───────────────────────────────────────────────
app.get('/api/audit-logs', async (req, res) => {
  try {
    res.json(await db.getAuditLogs(req.query));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/audit-logs', async (req, res) => {
  try {
    await db.addAuditLog(req.body);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/audit-logs', async (req, res) => {
  try {
    // Hanya Superadmin yang boleh menghapus audit log (verifikasi via header)
    const role = req.headers['x-admin-role'];
    if (role !== 'superadmin') return res.status(403).json({ error: 'Hanya Superadmin yang bisa menghapus riwayat' });
    
    await db.deleteAuditLogs();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SETTINGS ─────────────────────────────────────────────────
app.get('/api/settings', async (_req, res) => {
  try {
    const s = await db.getSettings();
    delete s.login_password; // jangan kirim password ke frontend
    res.json(s);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/settings', async (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: 'key diperlukan' });
  await db.updateSetting(key, String(value));
  res.json({ ok: true });
});

// ── TRANSACTIONS ─────────────────────────────────────────────
app.get('/api/transactions', async (req, res) => {
  try {
    res.json(await db.getTransactions(req.query));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const body = req.body;
    if (!body.id) body.id = 'txn-' + Date.now();
    await db.addTransaction(body);
    
    // Log Audit
    await db.addAuditLog({
      user_id: req.admin.id,
      user_name: req.admin.name,
      action: 'create',
      module: 'finance',
      doc_id: body.id,
      changes_after: body,
      metadata: { ip: req.ip, ua: req.headers['user-agent'] }
    });
    
    res.json({ ok: true, id: body.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    // Ambil data sebelum update (opsional untuk audit)
    const oldData = await db.getTransactions({ id: req.params.id });
    
    const ok = await db.updateTransaction(req.params.id, req.body);
    if (ok) {
      await db.addAuditLog({
        user_id: req.admin.id,
        user_name: req.admin.name,
        action: 'update',
        module: 'finance',
        doc_id: req.params.id,
        changes_before: oldData[0] || null,
        changes_after: req.body,
        metadata: { ip: req.ip, ua: req.headers['user-agent'] }
      });
    }
    res.json({ ok });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const oldData = await db.getTransactions({ id: req.params.id });
    await db.deleteTransaction(req.params.id);
    
    await db.addAuditLog({
      user_id: req.admin.id,
      user_name: req.admin.name,
      action: 'delete',
      module: 'finance',
      doc_id: req.params.id,
      changes_before: oldData[0] || null,
      metadata: { ip: req.ip, ua: req.headers['user-agent'] }
    });
    
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/transactions-all', async (req, res) => {
  await db.deleteAllTransactions();
  res.json({ ok: true });
});

// ── FLEET (ARMADA) ───────────────────────────────────────────
app.get('/api/fleet', async (_req, res) => {
  try {
    res.json(await db.getFleet());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/fleet', async (req, res) => {
  const f = req.body;
  if (!f.id || !f.nopol) return res.status(400).json({ error: 'id dan nopol diperlukan' });
  await db.addFleet(f);
  res.status(201).json({ ok: true });
});

app.put('/api/fleet/:id', async (req, res) => {
  const ok = await db.updateFleet(req.params.id, req.body);
  if (!ok) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json({ ok: true });
});

// ── FLEET TIRES ──────────────────────────────────────────────
app.get('/api/fleet/:id/tires', async (req, res) => {
  try {
    res.json(await db.getFleetTires(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/fleet/:id/tires', async (req, res) => {
  try {
    const tire = { ...req.body, fleet_id: req.params.id };
    const ok = await db.upsertFleetTire(tire);
    res.json({ ok });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/fleet/tires/:tireId', async (req, res) => {
  try {
    const ok = await db.deleteFleetTire(req.params.tireId);
    res.json({ ok });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/fleet/:id', async (req, res) => {
  await db.deleteFleet(req.params.id);
  res.json({ ok: true });
});

// ── DRIVERS ──────────────────────────────────────────────────
app.get('/api/drivers', async (_req, res) => {
  res.json(await db.getDrivers());
});

app.post('/api/drivers', async (req, res) => {
  const { nama } = req.body || {};
  if (!nama) return res.status(400).json({ error: 'Nama diperlukan' });
  await db.addDriver(nama);
  res.status(201).json({ ok: true });
});

app.delete('/api/drivers/:nama', async (req, res) => {
  await db.deleteDriver(decodeURIComponent(req.params.nama));
  res.json({ ok: true });
});

// ── INVENTORY (GUDANG ONDERDIL) ──────────────────────────────
app.get('/api/inventory', async (_req, res) => {
  res.json(await db.getInventory());
});

app.post('/api/inventory', async (req, res) => {
  const sp = req.body;
  if (!sp.id || !sp.nama) return res.status(400).json({ error: 'id dan nama diperlukan' });
  await db.addInventory(sp);
  
  // Audit Log
  await db.addAuditLog({
    user_id: req.admin.id, user_name: req.admin.name,
    action: 'create', module: 'inventory', doc_id: sp.id,
    changes_after: sp, metadata: { ip: req.ip, agent: req.get('user-agent') }
  });

  res.status(201).json({ ok: true });
});

app.put('/api/inventory/:id', async (req, res) => {
  const ok = await db.updateInventory(req.params.id, req.body);
  if (!ok) return res.status(404).json({ error: 'Tidak ditemukan' });

  // Audit Log
  await db.addAuditLog({
    user_id: req.admin.id, user_name: req.admin.name,
    action: 'update', module: 'inventory', doc_id: req.params.id,
    changes_after: req.body, metadata: { ip: req.ip, agent: req.get('user-agent') }
  });

  res.json({ ok: true });
});

app.delete('/api/inventory/:id', async (req, res) => {
  const ok = await db.deleteInventory(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Tidak ditemukan' });

  // Audit Log
  await db.addAuditLog({
    user_id: req.admin.id, user_name: req.admin.name,
    action: 'delete', module: 'inventory', doc_id: req.params.id,
    metadata: { ip: req.ip, agent: req.get('user-agent') }
  });

  res.json({ ok: true });
});

app.post('/api/inventory/:id/install', async (req, res) => {
  const result = await db.installInventory(req.params.id, req.body);
  if (result.error) return res.status(400).json(result);
  res.status(201).json(result);
});

app.delete('/api/inventory/:id/install/:installId', async (req, res) => {
  const ok = await db.uninstallInventory(req.params.id, req.params.installId);
  if (!ok) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json({ ok: true });
});

// ── DASHBOARD SUMMARY ───────────────────────────────────────
app.get('/api/summary', async (req, res) => {
  try {
    const txns = await db.getTransactions(req.query);
    const inflow  = txns.filter(t=>t.type==='inflow').reduce((s,t)=>s+Number(t.amount),0);
    const outflow = txns.filter(t=>t.type==='outflow').reduce((s,t)=>s+Number(t.amount),0);
    const fleet   = await db.getFleet();
    const statusCount = fleet.reduce((acc,f)=>{ acc[f.status]=(acc[f.status]||0)+1; return acc; },{});
    res.json({
      inflow, outflow, net: inflow - outflow,
      margin: inflow > 0 ? ((inflow-outflow)/inflow*100).toFixed(1) : '0',
      txnCount: txns.length,
      fleet: statusCount,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sync/summary', async (req, res) => {
  try {
    // Mengembalikan data ringkas yang sering berubah untuk pengecekan cepat (sync)
    const txns = await db.getTransactions({ limit: 1 }); // Ambil 1 terbaru saja
    const settings = await db.getSettings();
    res.json({
      lastTxn: txns[0] ? txns[0].id : null,
      company: settings.company_name,
      timestamp: new Date().getTime()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── START SERVER ─────────────────────────────────────────────
db.init().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║          BHD SmartFlow API - Terhubung ke SQL                ║
  ╟──────────────────────────────────────────────────────────────╢
  ║  ✅ PC/Laptop : http://127.0.0.1:${PORT}             ║
  ║  🚀 Status    : Database SQL Aktif                           ║
  ╚══════════════════════════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('❌ Gagal inisialisasi database:', err.message);
  process.exit(1);
});

module.exports = app;
