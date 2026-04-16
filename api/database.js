// Vercel handles environment variables natively.
if (process.env.NODE_ENV !== 'production' && !process.env.POSTGRES_URL) {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
}
// Fix: Explicitly using 'pg' for Supabase connectivity (replacing accidental @vercel/postgres)
const { Pool } = require('pg');

/**
 * BHD SmartFlow — Database Layer (Postgres SQL)
 * PT. Bagus Harya Dwiprima
 */

// Parsing connection string manual (untuk menghindari error karakter spesial di username)
let pool;
let isMock = false;

const MOCK_DATA = {
    settings: [
        { key: 'company_name', value: 'PT. BAGUS HARYA DWIPRIMA (MOCK)' },
        { key: 'fleet_count', value: '10' },
        { key: 'login_username', value: 'admin' },
        { key: 'login_password', value: 'bhd2024' }
    ],
    admins: [
        { id: 'admin-1', username: 'admin', password: 'bhd2024', role: 'superadmin' }
    ],
    transactions: [
        { id: '1', type: 'inflow', amount: 5000000, label: 'Ritase Pasir', date: new Date().toISOString().split('T')[0], armada: 'B 1234 XY' },
        { id: '2', type: 'outflow', amount: 1500000, label: 'BBM Solar', date: new Date().toISOString().split('T')[0], armada: 'B 5678 ZW' }
    ],
    fleet: [
        { id: '1', nopol: 'B 1234 XY', driver: 'Bagus', status: 'jalan' },
        { id: '2', nopol: 'B 5678 ZW', driver: 'Wizak', status: 'bengkel' }
    ],
    drivers: [{ nama: 'Bagus' }, { nama: 'Wizak' }]
};

try {
    let dbUrl = process.env.SUPABASE_URL_POOLER || process.env.POSTGRES_URL;
    if (!dbUrl) {
        console.warn('⚠ Database URL tidak ditemukan. Menggunakan MOCK MODE.');
        isMock = true;
    } else {
        // Optimization for Supabase Pooler (PgBouncer)
        if (dbUrl.includes('pooler.supabase.com') && !dbUrl.includes('pgbouncer=true')) {
            dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'pgbouncer=true';
        }

        pool = new Pool({
            connectionString: dbUrl,
            ssl: { rejectUnauthorized: false },
            connectionTimeoutMillis: 15000, // Menambah timeout ke 15 detik
        });
    }
} catch (e) {
    console.error('❌ Gagal inisialisasi Pool:', e.message);
    isMock = true;
}

// Interceptor Query untuk Mock / Real
const query = async (text, params) => {
    if (isMock) {
        const sql = text.toLowerCase();
        if (sql.includes('from settings')) return { rows: MOCK_DATA.settings };
        if (sql.includes('from admins')) return { rows: MOCK_DATA.admins };
        if (sql.includes('from transactions')) return { rows: MOCK_DATA.transactions };
        if (sql.includes('from fleet')) return { rows: MOCK_DATA.fleet };
        if (sql.includes('from drivers')) return { rows: MOCK_DATA.drivers };
        if (sql.includes('select now()')) return { rows: [{ now: new Date() }] };
        if (sql.includes('select count(*)')) return { rows: [{ count: '1' }] };
        return { rows: [], rowCount: 0 };
    }
    return pool.query(text, params);
};

// ─── SQL SCHEMA ──────────────────────────────────────────────
const SCHEMA = `
-- Authentication
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT,
    active BOOLEAN DEFAULT TRUE
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    amount BIGINT DEFAULT 0,
    muat TEXT,
    bongkar TEXT,
    label TEXT,
    sub TEXT,
    date TEXT,
    armada TEXT,
    driver TEXT,
    toko TEXT,
    nota TEXT,
    kategori TEXT,
    status TEXT,
    sparepart_id TEXT,
    posisi TEXT
);

-- Fleet (Armada)
CREATE TABLE IF NOT EXISTS fleet (
    id TEXT PRIMARY KEY,
    nopol TEXT UNIQUE NOT NULL,
    driver TEXT,
    status TEXT,
    pajak TEXT,
    kir TEXT
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
    nama TEXT PRIMARY KEY
);

-- Inventory (Gudang)
CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    spek TEXT,
    kategori TEXT,
    toko TEXT,
    nota TEXT,
    tgl_masuk TEXT,
    stok_awal INTEGER DEFAULT 0,
    stok_sisa INTEGER DEFAULT 0,
    stok_min INTEGER DEFAULT 5,
    harga_satuan BIGINT DEFAULT 0,
    catatan TEXT
);

-- Fleet Tires Tracking (Phase 2)
CREATE TABLE IF NOT EXISTS fleet_tires (
    id SERIAL PRIMARY KEY,
    fleet_id TEXT REFERENCES fleet(id) ON DELETE CASCADE,
    position TEXT NOT NULL,
    serial_number TEXT,
    brand TEXT,
    condition TEXT,
    installed_date TEXT
);

-- Installed Spareparts tracking
CREATE TABLE IF NOT EXISTS inventory_installed (
    id SERIAL PRIMARY KEY,
    inventory_id TEXT REFERENCES inventory(id) ON DELETE CASCADE,
    armada TEXT,
    tgl_pasang TEXT,
    ritase INTEGER DEFAULT 0,
    txn_id TEXT
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    action TEXT, -- create, update, delete
    module TEXT, -- dashboard, armada, inventory, finance
    doc_id TEXT,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    changes_before JSONB,
    changes_after JSONB,
    metadata JSONB -- ip, user-agent, etc
);
`;

async function init() {
    if (isMock) return; // Sudah dalam mode mock

    try {
        console.log('⏳ Menghubungkan ke Postgres...');
        
        // Cek koneksi (menggunakan wrapper query yang mendukung mock)
        // Kita gunakan timeout pendek khusus untuk tes awal agar tidak hang lama
        await query('SELECT NOW()');
        
        // Buat tabel jika belum ada
        await query(SCHEMA);
        console.log('✅ Skema database SQL siap');

        // Seed admin jika kosong
        const adminCheck = await query('SELECT COUNT(*) FROM admins');
        if (parseInt(adminCheck.rows[0].count) === 0) {
            console.log('🌱 Seeding default admin...');
            await query(
                "INSERT INTO admins (id, username, password, role, active) VALUES ('admin-1', 'admin', 'bhd2024', 'superadmin', true)"
            );
        }

        // Seed settings jika kosong
        const settingsCheck = await query('SELECT COUNT(*) FROM settings');
        if (parseInt(settingsCheck.rows[0].count) === 0) {
            console.log('🌱 Seeding default settings...');
            const defaults = [
                ['company_name', 'PT. BAGUS HARYA DWIPRIMA'],
                ['fleet_count', '6'],
                ['login_username', 'admin'],
                ['login_password', 'bhd2024'],
                ['admin_reg_code', 'BHD2024']
            ];
            for (const [key, val] of defaults) {
                await query('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, val]);
            }
        }
    } catch (e) {
        console.warn('⚠ Gagal terhubung ke Database Asli. Beralih ke MODE MOCK:', e.message);
        isMock = true;
    }
}

const db = {
    init,

    // ----- SETTINGS & AUTH -----
    getSettings: async () => {
        const { rows } = await query('SELECT * FROM settings');
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        return settings;
    },

    updateSetting: async (key, value) => {
        await query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
            [key, value]
        );
    },

    validateAdmin: async (username, password) => {
        const { rows } = await query(
            'SELECT * FROM admins WHERE username = $1 AND password = $2',
            [username, password]
        );
        const user = rows[0] || null;
        if (user && user.active === false) {
            throw new Error('Akun ditangguhkan (Blokir). Hubungi Superadmin.');
        }
        return user;
    },

registerAdmin: async (username, password, role = 'admin') => {
        const id = 'admin-' + Date.now();
        await query(
            'INSERT INTO admins (id, username, password, role, active) VALUES ($1, $2, $3, $4, $5)',
            [id, username, password, role, true]
        );
        return { id, username, role, active: true };
    },

    updateAdminPassword: async (username, newPassword) => {
        const { rowCount } = await query(
            'UPDATE admins SET password = $2 WHERE username = $1',
            [username, newPassword]
        );
        return rowCount > 0;
    },

    getAdmins: async () => {
        const { rows } = await query('SELECT id, username, role, active FROM admins ORDER BY username ASC');
        return rows;
    },

    updateAdmin: async (id, data) => {
        const fields = [];
        const params = [];
        let i = 1;
        for (const [key, val] of Object.entries(data)) {
            fields.push(`${key} = $${i++}`);
            params.push(val);
        }
        params.push(id);
        const { rowCount } = await query(
            `UPDATE admins SET ${fields.join(', ')} WHERE id = $${i}`,
            params
        );
        return rowCount > 0;
    },

    deleteAdmin: async (id) => {
        const { rowCount } = await query('DELETE FROM admins WHERE id = $1', [id]);
        return rowCount > 0;
    },

    // ----- AUDIT LOGS -----
    getAuditLogs: async (filters = {}) => {
        let sql = 'SELECT * FROM audit_logs WHERE 1=1';
        const params = [];
        let i = 1;

        if (filters.module) {
            sql += ` AND module = $${i++}`;
            params.push(filters.module);
        }
        if (filters.action) {
            sql += ` AND action = $${i++}`;
            params.push(filters.action);
        }
        if (filters.doc_id) {
            sql += ` AND doc_id = $${i++}`;
            params.push(filters.doc_id);
        }

        sql += ' ORDER BY timestamp DESC LIMIT 100';
        const { rows } = await query(sql, params);
        return rows;
    },

    addAuditLog: async (log) => {
        await query(
            `INSERT INTO audit_logs 
            (user_id, user_name, action, module, doc_id, changes_before, changes_after, metadata)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [log.user_id, log.user_name, log.action, log.module, log.doc_id, log.changes_before, log.changes_after, log.metadata]
        );
    },

    deleteAuditLogs: async () => {
        await query('DELETE FROM audit_logs');
    },

    // ----- TRANSACTIONS -----
    getTransactions: async (filters = {}) => {
        let sql = 'SELECT * FROM transactions WHERE 1=1';
        const params = [];
        let i = 1;

        if (filters.from) {
            sql += ` AND date >= $${i++}`;
            params.push(filters.from);
        }
        if (filters.to) {
            sql += ` AND date <= $${i++}`;
            params.push(filters.to);
        }
        if (filters.type) {
            sql += ` AND type = $${i++}`;
            params.push(filters.type);
        }
        if (filters.armada) {
            sql += ` AND armada = $${i++}`;
            params.push(filters.armada);
        }

        sql += ' ORDER BY date DESC';
        const { rows } = await query(sql, params);
        return rows.map(r => ({ ...r, amount: parseInt(r.amount) }));
    },

    addTransaction: async (t) => {
        await query(
            `INSERT INTO transactions 
            (id, type, amount, label, sub, date, armada, driver, toko, nota, kategori, status, sparepart_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [t.id, t.type, t.amount, t.label || '', t.sub || '', t.date, t.armada || '', t.driver || '', t.toko || '', t.nota || '', t.kategori || '', t.status || 'lunas', t.sparepart_id || '']
        );
    },

    updateTransaction: async (id, data) => {
        const fields = [];
        const params = [];
        let i = 1;
        for (const [key, val] of Object.entries(data)) {
            if (key === 'id') continue;
            fields.push(`${key} = $${i++}`);
            params.push(val);
        }
        params.push(id);
        const { rowCount } = await query(
            `UPDATE transactions SET ${fields.join(', ')} WHERE id = $${i}`,
            params
        );
        return rowCount > 0;
    },

    deleteTransaction: async (id) => {
        if (isMock) {
            return true; // Simple mock success
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Ambil info transaksi sebelum dihapus
            const { rows } = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
            if (rows.length > 0) {
// ... existing logic ...
                const t = rows[0];
                // Jika ini adalah outflow onderdil yang terhubung ke stok
                if (t.type === 'outflow' && t.kategori === 'Onderdil' && t.sparepart_id) {
                    // Kembalikan stok
                    await client.query('UPDATE inventory SET stok_sisa = stok_sisa + 1 WHERE id = $1', [t.sparepart_id]);
                    // Hapus entry di inventory_installed yang sesuai
                    await client.query(
                        `DELETE FROM inventory_installed WHERE id = (
                            SELECT id FROM inventory_installed 
                            WHERE txn_id = $1 OR (inventory_id = $2 AND armada = $3 AND tgl_pasang = $4)
                            LIMIT 1
                        )`,
                        [t.id, t.sparepart_id, t.armada, t.date]);
                }
            }

            const { rowCount } = await client.query('DELETE FROM transactions WHERE id = $1', [id]);
            await client.query('COMMIT');
            return rowCount > 0;
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    },

    deleteAllTransactions: async () => {
        await pool.query('DELETE FROM transactions');
    },

    // ----- FLEET -----
    getFleet: async () => {
        const { rows } = await pool.query('SELECT * FROM fleet');
        return rows;
    },

    addFleet: async (f) => {
        await pool.query(
            'INSERT INTO fleet (id, nopol, driver, status, pajak, kir) VALUES ($1, $2, $3, $4, $5, $6)',
            [f.id, f.nopol, f.driver || '', f.status || 'jalan', f.pajak || '', f.kir || '']
        );
    },

    updateFleet: async (id, data) => {
        const fields = [];
        const params = [];
        let i = 1;
        for (const [key, val] of Object.entries(data)) {
            if (key === 'id') continue;
            fields.push(`${key} = $${i++}`);
            params.push(val);
        }
        params.push(id);
        const { rowCount } = await pool.query(
            `UPDATE fleet SET ${fields.join(', ')} WHERE id = $${i}`,
            params
        );
        return rowCount > 0;
    },

    deleteFleet: async (id) => {
        const { rowCount } = await pool.query('DELETE FROM fleet WHERE id = $1', [id]);
        return rowCount > 0;
    },

    // ----- FLEET TIRES -----
    getFleetTires: async (fleetId) => {
        const { rows } = await pool.query('SELECT * FROM fleet_tires WHERE fleet_id = $1 ORDER BY position ASC', [fleetId]);
        return rows;
    },

    upsertFleetTire: async (tire) => {
        // Upsert based on fleet_id and position
        const { rowCount } = await pool.query(
            `INSERT INTO fleet_tires (fleet_id, position, serial_number, brand, condition, installed_date)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (fleet_id, position) DO UPDATE SET 
             serial_number = EXCLUDED.serial_number,
             brand = EXCLUDED.brand,
             condition = EXCLUDED.condition,
             installed_date = EXCLUDED.installed_date`,
            [tire.fleet_id, tire.position, tire.serial_number, tire.brand, tire.condition, tire.installed_date]
        );
        return rowCount > 0;
    },

    deleteFleetTire: async (id) => {
        const { rowCount } = await pool.query('DELETE FROM fleet_tires WHERE id = $1', [id]);
        return rowCount > 0;
    },

    // ----- DRIVERS -----
    getDrivers: async () => {
        const { rows } = await pool.query('SELECT * FROM drivers');
        return rows.map(r => r.nama);
    },

    addDriver: async (nama) => {
        await pool.query('INSERT INTO drivers (nama) VALUES ($1) ON CONFLICT DO NOTHING', [nama]);
    },

    deleteDriver: async (nama) => {
        await pool.query('DELETE FROM drivers WHERE nama = $1', [nama]);
    },

    // ----- INVENTORY -----
    getInventory: async () => {
        const { rows: inventory } = await pool.query('SELECT * FROM inventory');
        const { rows: installed } = await pool.query('SELECT * FROM inventory_installed');
        
        return inventory.map(sp => ({
            ...sp,
            harga_satuan: parseInt(sp.harga_satuan),
            installed: installed.filter(i => i.inventory_id === sp.id)
        }));
    },

    addInventory: async (sp) => {
        await pool.query(
            `INSERT INTO inventory 
            (id, nama, spek, kategori, toko, nota, tgl_masuk, stok_awal, stok_sisa, stok_min, harga_satuan, catatan)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [sp.id, sp.nama, sp.spek || '', sp.kategori || '', sp.toko || '', sp.nota || '', sp.tgl_masuk, sp.stok_awal, sp.stok_sisa, sp.stok_min || 5, sp.hargaSatuan || 0, sp.catatan || '']
        );
    },

    updateInventory: async (id, data) => {
        const fields = [];
        const params = [];
        let i = 1;
        for (const [key, val] of Object.entries(data)) {
            if (key === 'id' || key === 'installed') continue;
            fields.push(`${key} = $${i++}`);
            params.push(val);
        }
        params.push(id);
        const { rowCount } = await pool.query(
            `UPDATE inventory SET ${fields.join(', ')} WHERE id = $${i}`,
            params
        );
        return rowCount > 0;
    },

    deleteInventory: async (id) => {
        const { rowCount } = await pool.query('DELETE FROM inventory WHERE id = $1', [id]);
        return rowCount > 0;
    },

    installInventory: async (id, installData) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Cek stok
            const { rows } = await client.query('SELECT stok_sisa FROM inventory WHERE id = $1', [id]);
            if (rows.length === 0) throw new Error('Item tidak ditemukan');
            
            const jml = installData.jumlah || 1;
            if (rows[0].stok_sisa < jml) throw new Error('Stok tidak cukup');
            
            // Kurangi stok
            await client.query('UPDATE inventory SET stok_sisa = stok_sisa - $1 WHERE id = $2', [jml, id]);
            
            // Tambah catatan terpasang (bisa beberapa jika jml > 1)
            for (let i = 0; i < jml; i++) {
                await client.query(
                    'INSERT INTO inventory_installed (inventory_id, armada, tgl_pasang, ritase, txn_id) VALUES ($1, $2, $3, $4, $5)',
                    [id, installData.armada, installData.tgl_pasang, 0, installData.txnId]
                );
            }
            
            await client.query('COMMIT');
            return { ok: true };
        } catch (e) {
            await client.query('ROLLBACK');
            return { error: e.message };
        } finally {
            client.release();
        }
    },

    uninstallInventory: async (id, installId) => {
        const client = isMock ? { query: async () => ({ rows: [] }), release: () => {} } : await pool.connect();
        try {
            if (!isMock) await client.query('BEGIN');
            
            // Ambil info pemasangan
            const { rows } = await client.query('SELECT * FROM inventory_installed WHERE id = $1', [installId]);
            if (!isMock && rows.length === 0) throw new Error('Data pemasangan tidak ditemukan');
            
            // Hapus pemasangan
            await client.query('DELETE FROM inventory_installed WHERE id = $1', [installId]);
            
            // Kembalikan stok (asumsi per baris = 1 unit)
            await client.query('UPDATE inventory SET stok_sisa = stok_sisa + 1 WHERE id = $1', [id]);
            
            if (!isMock) await client.query('COMMIT');
            return true;
        } catch (e) {
            if (!isMock) await client.query('ROLLBACK');
            return false;
        } finally {
            if (!isMock) client.release();
        }
    },

};

const exportedDb = {
    ...db,
    init,
    query,
    isMock: () => isMock
};

module.exports = exportedDb;
