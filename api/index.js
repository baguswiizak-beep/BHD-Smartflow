// ═══════════════════════════════════════════════════════════════
// SERVER.JS — BHD SmartFlow Backend API
// Express + JSON Storage | PT. Bagus Harya Dwiprima
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./database');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── MIDDLEWARE ──────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
// Anti cache global
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
// Sajikan file HTML utama dari folder parent (BHD/)
app.use(express.static(path.join(__dirname, '..')));

// ─── HEALTH CHECK ────────────────────────────────────────────
app.get('/api/ping', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const settings = db.getSettings();
  if (username === settings.login_username && password === settings.login_password) {
    return res.json({ ok: true, username });
  }
  res.status(401).json({ ok: false, error: 'Username atau password salah' });
});

app.post('/api/auth/change-password', async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const settings = db.getSettings();
  if (oldPassword !== settings.login_password) {
    return res.status(403).json({ error: 'Password lama tidak cocok' });
  }
  await db.updateSetting('login_password', newPassword);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════
app.get('/api/settings', (_req, res) => {
  const s = db.getSettings();
  delete s.login_password; // jangan kirim password ke frontend
  res.json(s);
});

app.put('/api/settings', async (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: 'key diperlukan' });
  if (key === 'login_password') return res.status(403).json({ error: 'Gunakan endpoint change-password' });
  await db.updateSetting(key, String(value));
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════
// TRANSACTIONS
// ════════════════════════════════════════════════════════════════
app.get('/api/transactions', (req, res) => {
  res.json(db.getTransactions(req.query));
});

app.post('/api/transactions', async (req, res) => {
  const t = req.body;
  if (!t || !t.id || !t.type || !t.date) {
    return res.status(400).json({ error: 'Data tidak lengkap (id, type, date diperlukan)' });
  }
  await db.addTransaction({
    id:       String(t.id),
    type:     t.type,
    amount:   Number(t.amount) || 0,
    label:    t.label     || '',
    kategori: t.kategori  || '',
    armada:   t.armada    || '',
    driver:   t.driver    || '',
    toko:     t.toko      || '',
    nota:     t.nota      || '',
    date:     t.date,
    status:   t.status    || 'lunas',
  });
  res.status(201).json({ ok: true, id: t.id });
});

app.put('/api/transactions/:id', async (req, res) => {
  const ok = await db.updateTransaction(req.params.id, req.body);
  if (!ok) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json({ ok: true });
});

app.delete('/api/transactions/:id', async (req, res) => {
  // Cek wildcard 'all' untuk hapus semua
  if (req.params.id === 'all') {
    await db.deleteAllTransactions();
    return res.json({ ok: true });
  }
  const ok = await db.deleteTransaction(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════
// FLEET (ARMADA)
// ════════════════════════════════════════════════════════════════
app.get('/api/fleet', (_req, res) => {
  res.json(db.getFleet());
});

app.post('/api/fleet', async (req, res) => {
  const f = req.body;
  if (!f.id || !f.nopol) return res.status(400).json({ error: 'id dan nopol diperlukan' });
  await db.addFleet({ id:f.id, nopol:f.nopol, driver:f.driver||'', status:f.status||'jalan', pajak:f.pajak||'', kir:f.kir||'' });
  res.status(201).json({ ok: true });
});

app.put('/api/fleet/:id', async (req, res) => {
  const ok = await db.updateFleet(req.params.id, req.body);
  if (!ok) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json({ ok: true });
});

app.delete('/api/fleet/:id', async (req, res) => {
  const ok = await db.deleteFleet(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════
// DRIVERS
// ════════════════════════════════════════════════════════════════
app.get('/api/drivers', (_req, res) => {
  res.json(db.getDrivers());
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

// ════════════════════════════════════════════════════════════════
// INVENTORY (GUDANG ONDERDIL)
// ════════════════════════════════════════════════════════════════
app.get('/api/inventory', (_req, res) => {
  res.json(db.getInventory());
});

app.post('/api/inventory', async (req, res) => {
  const sp = req.body;
  if (!sp.id || !sp.nama) return res.status(400).json({ error: 'id dan nama diperlukan' });
  await db.addInventory(sp);
  res.status(201).json({ ok: true });
});

app.put('/api/inventory/:id', async (req, res) => {
  const ok = await db.updateInventory(req.params.id, req.body);
  if (!ok) return res.status(404).json({ error: 'Tidak ditemukan' });
  res.json({ ok: true });
});

app.delete('/api/inventory/:id', async (req, res) => {
  const ok = await db.deleteInventory(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Tidak ditemukan' });
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

// ════════════════════════════════════════════════════════════════
// DASHBOARD SUMMARY
// ════════════════════════════════════════════════════════════════
app.get('/api/summary', (req, res) => {
  const txns = db.getTransactions(req.query);
  const inflow  = txns.filter(t=>t.type==='inflow').reduce((s,t)=>s+t.amount,0);
  const outflow = txns.filter(t=>t.type==='outflow').reduce((s,t)=>s+t.amount,0);
  const fleet   = db.getFleet();
  const statusCount = fleet.reduce((acc,f)=>{ acc[f.status]=(acc[f.status]||0)+1; return acc; },{});
  res.json({
    inflow, outflow, net: inflow - outflow,
    margin: inflow > 0 ? ((inflow-outflow)/inflow*100).toFixed(1) : '0',
    txnCount: txns.length,
    fleet: statusCount,
  });
});

// ─── CHANGE PASSWORD ENDPOINT (shortcut dari settings) ───────
app.post('/api/change-password', async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const settings = db.getSettings();
  if (oldPassword !== settings.login_password) {
    return res.status(403).json({ error: 'Password lama tidak cocok' });
  }
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Password baru minimal 4 karakter' });
  }
  await db.updateSetting('login_password', newPassword);
  res.json({ ok: true, message: 'Password berhasil diubah' });
});

// ─── START SERVER ─────────────────────────────────────────────
db.init().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const os   = require('os');
    const nets = os.networkInterfaces();
    let localIP = 'localhost';
    for (const iface of Object.values(nets)) {
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) { localIP = alias.address; break; }
      }
    }
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║   BHD SmartFlow Backend — v2.0 (Cloud)          ║');
    console.log('║   PT. Bagus Harya Dwiprima                      ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  ✅ PC/Laptop : http://127.0.0.1:${PORT}             ║`);
    console.log(`║  📱 HP (WiFi) : http://${localIP}:${PORT}   ║`);
    console.log(`║  ☁️ Database  : Firebase Realtime Database      ║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  🌐 Buka di browser: http://127.0.0.1:${PORT}/    ║`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log('  Tekan Ctrl+C untuk menghentikan server.');
  });
});
