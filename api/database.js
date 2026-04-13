const FIREBASE_URL = 'https://bhd-smartflow-default-rtdb.firebaseio.com';

const DEFAULTS = {
  transactions: [],
  fleet: [],
  drivers: [],
  inventory: [],
  settings: {},
};

let _db = null;

async function init() {
  try {
    const r = await fetch(`${FIREBASE_URL}/.json`);
    const data = await r.json();
    _db = data || DEFAULTS;
    console.log('✅ Berhasil terhubung ke Firebase Realtime Database');
  } catch (e) {
    console.error('⚠ Gagal mengambil data dari Firebase:', e.message);
    _db = DEFAULTS;
  }
}

async function save() {
  try {
    await fetch(`${FIREBASE_URL}/.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_db)
    });
  } catch (e) {
    console.error('⚠ Gagal menyimpan data ke Firebase:', e.message);
  }
}

const db = {
  init,
  // ----- READ -----
  get: () => _db,
  getTransactions: (filters = {}) => {
    let list = [...(_db.transactions || [])];
    if (filters.from)   list = list.filter(t => t.date >= filters.from);
    if (filters.to)     list = list.filter(t => t.date <= filters.to);
    if (filters.type)   list = list.filter(t => t.type === filters.type);
    if (filters.armada) list = list.filter(t => t.armada === filters.armada);
    return list.sort((a,b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  },

  // ----- TRANSACTIONS -----
  addTransaction: async (t) => {
    _db.transactions = _db.transactions || [];
    _db.transactions.unshift(t);
    await save();
  },
  updateTransaction: async (id, data) => {
    _db.transactions = _db.transactions || [];
    const i = _db.transactions.findIndex(t => t.id === id);
    if (i === -1) return false;
    _db.transactions[i] = { ..._db.transactions[i], ...data };
    await save();
    return true;
  },
  deleteTransaction: async (id) => {
    _db.transactions = _db.transactions || [];
    const before = _db.transactions.length;
    _db.transactions = _db.transactions.filter(t => t.id !== id);
    await save();
    return _db.transactions.length < before;
  },
  deleteAllTransactions: async () => {
    _db.transactions = [];
    await save();
  },

  // ----- FLEET -----
  getFleet: () => [...(_db.fleet || [])],
  addFleet: async (f) => {
    _db.fleet = _db.fleet || [];
    _db.fleet.push(f);
    await save();
  },
  updateFleet: async (id, data) => {
    _db.fleet = _db.fleet || [];
    const i = _db.fleet.findIndex(f => f.id === id);
    if (i === -1) return false;
    _db.fleet[i] = { ..._db.fleet[i], ...data };
    await save();
    return true;
  },
  deleteFleet: async (id) => {
    _db.fleet = _db.fleet || [];
    const before = _db.fleet.length;
    _db.fleet = _db.fleet.filter(f => f.id !== id);
    await save();
    return _db.fleet.length < before;
  },

  // ----- DRIVERS -----
  getDrivers: () => [...(_db.drivers || [])],
  addDriver: async (nama) => {
    _db.drivers = _db.drivers || [];
    if (!_db.drivers.includes(nama)) { _db.drivers.push(nama); await save(); }
  },
  deleteDriver: async (nama) => {
    _db.drivers = _db.drivers || [];
    _db.drivers = _db.drivers.filter(d => d !== nama);
    await save();
  },

  // ----- INVENTORY -----
  getInventory: () => (_db.inventory || []).map(sp => ({
    ...sp,
    installed: sp.installed || [],
  })),
  addInventory: async (sp) => {
    _db.inventory = _db.inventory || [];
    _db.inventory.push({ ...sp, installed: sp.installed || [] });
    await save();
  },
  updateInventory: async (id, data) => {
    _db.inventory = _db.inventory || [];
    const i = _db.inventory.findIndex(s => s.id === id);
    if (i === -1) return false;
    _db.inventory[i] = { ..._db.inventory[i], ...data };
    await save();
    return true;
  },
  deleteInventory: async (id) => {
    _db.inventory = _db.inventory || [];
    const before = _db.inventory.length;
    _db.inventory = _db.inventory.filter(s => s.id !== id);
    await save();
    return _db.inventory.length < before;
  },
  installInventory: async (id, installData) => {
    _db.inventory = _db.inventory || [];
    const sp = _db.inventory.find(s => s.id === id);
    if (!sp) return { error: 'Tidak ditemukan' };
    if ((sp.stokSisa || 0) < (installData.jumlah || 1)) return { error: 'Stok tidak cukup' };
    sp.installed = sp.installed || [];
    sp.installed.push(installData);
    sp.stokSisa = (sp.stokSisa || 0) - (installData.jumlah || 1);
    await save();
    return { ok: true };
  },
  uninstallInventory: async (id, installId) => {
    _db.inventory = _db.inventory || [];
    const sp = _db.inventory.find(s => s.id === id);
    if (!sp) return false;
    const inst = (sp.installed || []).find(i => i.id === installId);
    if (!inst) return false;
    sp.installed = sp.installed.filter(i => i.id !== installId);
    sp.stokSisa = (sp.stokSisa || 0) + (inst.jumlah || 1);
    await save();
    return true;
  },

  // ----- SETTINGS -----
  getSettings: () => ({ ...(_db.settings || {}) }),
  updateSetting: async (key, value) => {
    _db.settings = _db.settings || {};
    _db.settings[key] = value;
    await save();
  },
};

module.exports = db;
