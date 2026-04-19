const express = require('express');
const cors = require('cors');

// Move db require inside ensureDb or routes to prevent top-level crashes during module load
let db;
try {
    db = require('./database');
} catch (e) {
    console.error('Database module load failed:', e.message);
}

const app = express();
const PORT = process.env.PORT || 3001;

// ── SSE REALTIME DISPATCHER ──────────────────────────
let clients = [];
function broadcastChange(payload = { type: 'refresh' }) {
    console.log(`📡 Broadcasting change to ${clients.length} clients...`);
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });
}
// ──────────────────────────────────────────────────────

// ── DATABASE INITIALIZATION PROMISE ──
let dbInitPromise = null;
const ensureDb = async () => {
    if (!db) throw new Error('Database module not loaded. Check environment variables (POSTGRES_URL / SUPABASE_URL_POOLER).');
    if (!dbInitPromise) dbInitPromise = db.init();
    return dbInitPromise;
};
// ──────────────────────────────────────

app.use(cors());
app.use(express.json());

// Middleware untuk mengekstrak info Admin dari header (untuk Audit Trail)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    req.admin = {
        id: req.headers['x-admin-id'] || 'system',
        name: req.headers['x-admin-name'] || 'System',
        role: req.headers['x-admin-role'] || 'admin'
    };
    next();
});

// Serve static files from the root directory (to allow access via http://127.0.0.1:3001)
const path = require('path');
app.use(express.static(path.join(__dirname, '../')));

// ── HEALTH CHECK (tidak butuh DB) ────────────────────────────
app.get('/api/ping', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/realtime', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    clients.push(newClient);

    console.log(`🔌 Client connected to Realtime: ${clientId} (Total: ${clients.length})`);

    req.on('close', () => {
        console.log(`🔌 Client disconnected: ${clientId}`);
        clients = clients.filter(c => c.id !== clientId);
    });
});

app.get('/api/debug', (req, res) => {
  res.json({
    env: process.env.NODE_ENV || 'development',
    hasSupabasePooler: !!process.env.SUPABASE_URL_POOLER,
    supabasePoolerLength: process.env.SUPABASE_URL_POOLER ? process.env.SUPABASE_URL_POOLER.length : 0,
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    postgresUrlLength: process.env.POSTGRES_URL ? process.env.POSTGRES_URL.length : 0,
    isMockMode: false,
    dbLoaded: !!db
  });
});

app.get('/api/health', async (req, res) => {
  try {
    if (!db) throw new Error('Modul Database tidak termuat');
    await ensureDb();
    res.json({ status: 'ok', db: 'postgres', database: 'connected', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', database: 'disconnected', message: e.message });
  }
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

// PRESENCE
app.post('/api/auth/heartbeat', async (req, res) => {
  const { username, avatar } = req.body || {};
  if (username) await db.updatePresence(username, avatar);
  res.json({ ok: true });
});

app.get('/api/auth/active-users', (_req, res) => {
  res.json(db.getActiveUsers());
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
  broadcastChange({ type: 'settings', action: 'update', key });
  res.json({ ok: true });
});

app.put('/api/settings/admin_reg_code', async (req, res) => {
  const { value } = req.body || {};
  if (!value) return res.status(400).json({ error: 'Kode registrasi diperlukan' });
  await db.updateSetting('admin_reg_code', String(value));
  broadcastChange({ type: 'settings', action: 'update', key: 'admin_reg_code' });
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
    
    // Log Audit (Safe)
    try {
      await db.addAuditLog({
        user_id: req.admin?.id || 'system',
        user_name: req.admin?.name || 'System',
        action: 'create',
        module: 'finance',
        doc_id: body.id,
        changes_after: body,
        metadata: { ip: req.ip, ua: req.headers['user-agent'] }
      });
    } catch(ae) { console.warn('Audit log failed for txn:', ae.message); }
    
    broadcastChange({ type: 'transactions', action: 'create', id: body.id });
    res.json({ ok: true, id: body.id });
  } catch (e) {
    console.error('Error in POST /api/transactions:', e.stack);
    res.status(500).json({ error: e.message });
  }
});


app.put('/api/transactions/:id', async (req, res) => {
  try {
    const db = require('./database');
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
    if (ok) broadcastChange({ type: 'transactions', action: 'update', id: req.params.id });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const items = await db.getTransactions({ id: id });
    if (!items || items.length === 0) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    const txn = items[0];

    // Jika transaksi adalah pengeluaran onderdil yang terhubung ke inventory
    if (txn.sparepart_id || txn.type === 'outflow') {
      // Cari jika ada record inventory_installed terkait txn_id ini
      // Di database.js belum ada getInventoryInstalledByTxn, kita bisa query langsung atau tambahkan di db
      try {
        const { rows: installs } = await db.query('SELECT id, inventory_id FROM inventory_installed WHERE txn_id = $1', [id]);
        for (const inst of installs) {
          // Uninstall inventory restores stock (+1) and deletes the installation record
          await db.uninstallInventory(inst.inventory_id, inst.id);
        }
      } catch (ie) { console.warn('Check usage rollback failed:', ie.message); }
    }

    // Akhirnya hapus master transaksi
    await db.deleteTransaction(id);
    
    // Audit Log
    try {
      await db.addAuditLog({
        user_id: req.admin?.id || 'system',
        user_name: req.admin?.name || 'System',
        action: 'delete', module: 'finance', doc_id: id,
        changes_before: txn,
        metadata: { ip: req.ip, ua: req.headers['user-agent'] }
      });
    } catch(ae) { console.warn('Audit log failed during delete:', ae.message); }
    
    broadcastChange({ type: 'transactions', action: 'delete', id });
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete transaction failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});



app.delete('/api/transactions/reset', async (req, res) => {
  try {
    await db.resetTransactions();
    broadcastChange({ type: 'refresh' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/transactions-all', async (req, res) => {
    await db.resetTransactions();
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
  broadcastChange({ type: 'fleet', action: 'create' });
  res.status(201).json({ ok: true });
});

app.put('/api/fleet/:id', async (req, res) => {
  try {
    const ok = await db.updateFleet(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: 'Tidak ditemukan' });
    
    // Audit Log (Optional but safe)
    try {
      await db.addAuditLog({
        user_id: req.admin?.id || 'system',
        user_name: req.admin?.name || 'System',
        action: 'update',
        module: 'fleet',
        doc_id: req.params.id,
        changes_after: req.body,
        metadata: { ip: req.ip }
      });
    } catch(ae) { console.warn('Audit log failed for fleet update:', ae.message); }

    broadcastChange({ type: 'fleet', action: 'update', id: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    console.error('Error in PUT /api/fleet:', e.stack);
    res.status(500).json({ error: e.message });
  }
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
  broadcastChange({ type: 'fleet', action: 'delete', id: req.params.id });
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
  broadcastChange({ type: 'drivers', action: 'create' });
  res.status(201).json({ ok: true });
});

app.delete('/api/drivers/:nama', async (req, res) => {
  await db.deleteDriver(decodeURIComponent(req.params.nama));
  broadcastChange({ type: 'drivers', action: 'delete' });
  res.json({ ok: true });
});

// ── INVENTORY (GUDANG ONDERDIL) ──────────────────────────────
app.get('/api/inventory', async (_req, res) => {
  res.json(await db.getInventory());
});

app.post('/api/inventory', async (req, res) => {
  try {
    const sp = req.body;
    if (!sp.id || !sp.nama) return res.status(400).json({ error: 'id dan nama diperlukan' });
    await db.addInventory(sp);
    
    // Audit Log
    try {
      await db.addAuditLog({
        user_id: req.admin?.id || 'system', 
        user_name: req.admin?.name || 'System',
        action: 'create', module: 'inventory', doc_id: sp.id,
        changes_after: sp, metadata: { ip: req.ip, agent: req.get('user-agent') }
      });
    } catch(ae) { console.warn('Audit log failed but inventory saved:', ae.message); }

    broadcastChange({ type: 'inventory', action: 'create' });
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error('Crash avoided in POST /api/inventory:', e.stack);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  try {
    const ok = await db.updateInventory(req.params.id, req.body);
    if (!ok) return res.status(404).json({ error: 'Tidak ditemukan' });

    // Audit Log
    try {
      await db.addAuditLog({
        user_id: req.admin?.id || 'system', 
        user_name: req.admin?.name || 'System',
        action: 'update', module: 'inventory', doc_id: req.params.id,
        changes_after: req.body, metadata: { ip: req.ip, agent: req.get('user-agent') }
      });
    } catch(ae) { console.warn('Audit log failed but update saved:', ae.message); }

    broadcastChange({ type: 'inventory', action: 'update', id: req.params.id });
    res.json({ ok: true });
  } catch (e) {
    console.error('Crash avoided in PUT /api/inventory:', e.stack);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // 1. Audit Log 
    await db.addAuditLog({
      user_id: req.admin?.id || 'system', 
      user_name: req.admin?.name || 'System',
      action: 'delete', module: 'inventory', doc_id: id,
      metadata: { ip: req.ip, agent: req.get('user-agent') }
    });

    // 2. Perform actual deletion in DB
    const ok = await db.deleteInventory(id);
    if (!ok) {
        return res.status(404).json({ error: 'Item tidak ditemukan atau gagal dihapus' });
    }

    broadcastChange({ type: 'inventory', action: 'delete', id });
    res.json({ ok: true });
  } catch (e) {
    console.error('Error in DELETE /api/inventory:', e.message);
    res.status(500).json({ error: e.message });
  }
});


app.post('/api/inventory/sync-multi', async (req, res) => {
  const result = await db.bulkUpdateInventory(req.body || []);
  res.status(200).json({ ok: true });
});

app.post('/api/inventory/:id/install', async (req, res) => {
  const result = await db.installInventory(req.params.id, req.body);
  if (result.error) return res.status(400).json(result);
  res.status(201).json(result);
});

app.delete('/api/inventory/:id/install/:installId', async (req, res) => {
  const ok = await db.uninstallInventory(req.params.id, req.params.installId);
  if (!o