const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// ── Supabase Client ──
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fwuuhtmwhgisrkbtmasi.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

<<<<<<< Updated upstream
// ══════════════════════════════════════
// HEALTH CHECK
// ══════════════════════════════════════
app.get('/api/health', async (req, res) => {
  try {
    const { error } = await supabase.from('settings').select('key').limit(1);
    if (error) throw error;
    res.json({ status: 'ok', db: 'supabase', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
=======
// ════════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = await db.validateAdmin(username, password);
  if (user) {
    return res.json({ ok: true, username: user.username, role: user.role });
>>>>>>> Stashed changes
  }
});

<<<<<<< Updated upstream
// PING (alias health check untuk frontend)
app.get('/api/ping', async (req, res) => {
  try {
    const { error } = await supabase.from('settings').select('key').limit(1);
    if (error) throw error;
    res.json({ status: 'ok', db: 'supabase', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});// ══════════════════════════════════════
// TRANSACTIONS (Inflow & Outflow)
// ══════════════════════════════════════
app.get('/api/transactions', async (req, res) => {
  try {
    const { type, armada, startDate, endDate, limit = 500 } = req.query;
    let query = supabase.from('transactions').select('*').order('date', { ascending: false }).limit(Number(limit));
    if (type) query = query.eq('type', type);
    if (armada) query = query.eq('armada', armada);
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
=======
app.post('/api/auth/change-password', async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const settings = await db.getSettings();
  if (oldPassword !== settings.login_password) {
    return res.status(403).json({ error: 'Password lama tidak cocok' });
  }
  await db.updateSetting('login_password', newPassword);
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════
app.get('/api/settings', async (_req, res) => {
  const s = await db.getSettings();
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
app.get('/api/transactions', async (req, res) => {
  res.json(await db.getTransactions(req.query));
>>>>>>> Stashed changes
});

app.post('/api/transactions', async (req, res) => {
  try {
    const body = req.body;
    if (!body.id) body.id = 'txn-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
    if (!body.date) body.date = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase.from('transactions').insert([body]).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    delete body.id;
    const { data, error } = await supabase.from('transactions').update(body).eq('id', id).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

<<<<<<< Updated upstream
app.delete('/api/transactions', async (req, res) => {
  try {
    const { error } = await supabase.from('transactions').delete().neq('id', '');
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
=======
// ════════════════════════════════════════════════════════════════
// FLEET (ARMADA)
// ════════════════════════════════════════════════════════════════
app.get('/api/fleet', async (_req, res) => {
  res.json(await db.getFleet());
>>>>>>> Stashed changes
});

// ══════════════════════════════════════
// ARMADA
// ══════════════════════════════════════
app.get('/api/armada', async (req, res) => {
  try {
    const { data, error } = await supabase.from('armada').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/armada', async (req, res) => {
  try {
    const body = req.body;
    if (!body.id) body.id = 'arm-' + Date.now();
    const { data, error } = await supabase.from('armada').insert([body]).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/armada/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    delete body.id;
    const { data, error } = await supabase.from('armada').update(body).eq('id', id).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/armada/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('armada').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════
// DRIVERS
<<<<<<< Updated upstream
// ══════════════════════════════════════
app.get('/api/drivers', async (req, res) => {
  try {
    const { data, error } = await supabase.from('drivers').select('*').order('name', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/drivers', async (req, res) => {
  try {
    const body = req.body;
    if (!body.id) body.id = 'drv-' + Date.now();
    const { data, error } = await supabase.from('drivers').insert([body]).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
=======
// ════════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════════
// INVENTORY (GUDANG ONDERDIL)
// ════════════════════════════════════════════════════════════════
app.get('/api/inventory', async (_req, res) => {
  res.json(await db.getInventory());
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
app.get('/api/summary', async (req, res) => {
  const txns = await db.getTransactions(req.query);
  const inflow  = txns.filter(t=>t.type==='inflow').reduce((s,t)=>s+t.amount,0);
  const outflow = txns.filter(t=>t.type==='outflow').reduce((s,t)=>s+t.amount,0);
  const fleet   = await db.getFleet();
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
  const settings = await db.getSettings();
  if (oldPassword !== settings.login_password) {
    return res.status(403).json({ error: 'Password lama tidak cocok' });
>>>>>>> Stashed changes
  }
});

app.put('/api/drivers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    delete body.id;
    const { data, error } = await supabase.from('drivers').update(body).eq('id', id).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/drivers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════
// SPAREPARTS / ONDERDIL
// ══════════════════════════════════════
app.get('/api/spareparts', async (req, res) => {
  try {
    const { category } = req.query;
    let query = supabase.from('spareparts').select('*').order('name', { ascending: true });
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/spareparts', async (req, res) => {
  try {
    const body = req.body;
    if (!body.id) body.id = 'sp-' + Date.now();
    const { data, error } = await supabase.from('spareparts').insert([body]).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/spareparts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    delete body.id;
    const { data, error } = await supabase.from('spareparts').update(body).eq('id', id).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/spareparts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('spareparts').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════
// KATEGORI ONDERDIL
// ══════════════════════════════════════
app.get('/api/categories', async (req, res) => {
  try {
    const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const body = req.body;
    if (!body.id) body.id = 'cat-' + Date.now();
    const { data, error } = await supabase.from('categories').insert([body]).select().single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════
// SETTINGS
// ══════════════════════════════════════
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase.from('settings').select('*');
    if (error) throw error;
    const obj = {};
    (data || []).forEach(r => { obj[r.key] = r.value; });
    res.json({ success: true, data: obj });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await supabase.from('settings').upsert({ key, value: String(value) }, { onConflict: 'key' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════
// ADMINS
// ══════════════════════════════════════
app.get('/api/admins', async (req, res) => {
  try {
    const { data, error } = await supabase.from('admins').select('id, username, role, photo, created_at');
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/admins', async (req, res) => {
  try {
    const body = req.body;
    if (!body.id) body.id = 'adm-' + Date.now();
    const { data, error } = await supabase.from('admins').insert([body]).select('id, username, role, created_at').single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/admins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    delete body.id;
    const { data, error } = await supabase.from('admins').update(body).eq('id', id).select('id, username, role').single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/admins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('admins').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const { data, error } = await supabase
      .from('admins')
      .select('id, username, role, photo')
      .eq('username', username)
      .eq('password', password)
      .single();
    if (error || !data) return res.status(401).json({ success: false, error: 'Username atau password salah' });
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════
// SUMMARY / DASHBOARD
// ══════════════════════════════════════
app.get('/api/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = supabase.from('transactions').select('type, amount, category, armada, date');
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    const { data, error } = await query;
    if (error) throw error;

    let inflow = 0, outflow = 0;
    const byArmada = {};
    const byCategory = {};

    (data || []).forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'inflow') {
        inflow += amt;
        if (t.armada) {
          byArmada[t.armada] = byArmada[t.armada] || { inflow: 0, outflow: 0 };
          byArmada[t.armada].inflow += amt;
        }
      } else {
        outflow += amt;
        if (t.armada) {
          byArmada[t.armada] = byArmada[t.armada] || { inflow: 0, outflow: 0 };
          byArmada[t.armada].outflow += amt;
        }
        if (t.category) {
          byCategory[t.category] = (byCategory[t.category] || 0) + amt;
        }
      }
    });

    res.json({
      success: true,
      data: {
        inflow,
        outflow,
        profit: inflow - outflow,
        transactionCount: (data || []).length,
        byArmada,
        byCategory
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ══════════════════════════════════════
// START SERVER
// ══════════════════════════════════════
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BHD SmartFlow API running on port ${PORT}`));

module.exports = app;
