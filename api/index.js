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
  }
});

// PING (alias health check)
app.get('/api/ping', async (req, res) => {
  try {
    const { error } = await supabase.from('settings').select('key').limit(1);
    if (error) throw error;
    res.json({ status: 'ok', db: 'supabase', timestamp: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ══════════════════════════════════════
// AUTH LOGIN
// ══════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const { data, error } = await supabase
      .from('admins')
      .select('id, username, role, photo')
      .eq('username', username)
      .eq('password', password)
      .single();
    if (error || !data) return res.status(401).json({ ok: false, error: 'Username atau password salah' });
    res.json({ ok: true, username: data.username, role: data.role, photo: data.photo, id: data.id });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ══════════════════════════════════════
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

app.delete('/api/transactions', async (req, res) => {
  try {
    const { error } = await supabase.from('transactions').delete().neq('id', '');
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
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
