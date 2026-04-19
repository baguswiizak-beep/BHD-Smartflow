<<<<<<< HEAD
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
=======
// Vercel handles environment variables natively.
if (process.env.NODE_ENV !== 'production' && !process.env.POSTGRES_URL) {
    require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
}
>>>>>>> main
// Fix: Explicitly using 'pg' for Supabase connectivity (replacing accidental @vercel/postgres)
const { Pool } = require('pg');

/**
 * BHD SmartFlow — Database Layer (Postgres SQL)
 * PT. Bagus Harya Dwiprima
 */

// Parsing connection string manual (untuk menghindari error karakter spesial di username)
<<<<<<< HEAD
const dbUrl = new URL(process.env.POSTGRES_URL);
const pool = new Pool({
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    host: dbUrl.hostname,
    port: dbUrl.port || 5432,
    database: dbUrl.pathname.split('/')[1] || 'postgres',
    ssl: {
        rejectUnauthorized: false
    }
});
=======
let pool;



try {
    let dbUrl = process.env.SUPABASE_URL_POOLER || process.env.POSTGRES_URL;
    if (!dbUrl) {
        throw new Error('Database URL (POSTGRES_URL / SUPABASE_URL_POOLER) tidak ditemukan dilingkungan (env).');
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
    throw e;
}

// Database Query Wrapper
const query = async (text, params) => {
    return pool.query(text, params);
};
>>>>>>> main

// ─── SQL SCHEMA ──────────────────────────────────────────────
const SCHEMA = `
-- Authentication
CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
<<<<<<< HEAD
    role TEXT
=======
    role TEXT,
    active BOOLEAN DEFAULT TRUE
>>>>>>> main
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    amount BIGINT DEFAULT 0,
<<<<<<< HEAD
=======
    muat TEXT,
    bongkar TEXT,
>>>>>>> main
    label TEXT,
    sub TEXT,
    date TEXT,
    armada TEXT,
    driver TEXT,
    toko TEXT,
    nota TEXT,
    kategori TEXT,
    status TEXT,
<<<<<<< HEAD
    sparepart_id TEXT
=======
    sparepart_id TEXT,
    posisi TEXT
>>>>>>> main
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
<<<<<<< HEAD
=======
    stok_min INTEGER DEFAULT 5,
>>>>>>> main
    harga_satuan BIGINT DEFAULT 0,
    catatan TEXT
);

<<<<<<< HEAD
=======
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

>>>>>>> main
-- Installed Spareparts tracking
CREATE TABLE IF NOT EXISTS inventory_installed (
    id SERIAL PRIMARY KEY,
    inventory_id TEXT REFERENCES inventory(id) ON DELETE CASCADE,
    armada TEXT,
    tgl_pasang TEXT,
    ritase INTEGER DEFAULT 0,
<<<<<<< HEAD
    txn_id TEXT
=======
    txn_id TEXT,
    posisi TEXT
>>>>>>> main
);

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
<<<<<<< HEAD
`;

async function init() {
    try {
        console.log('⏳ Menghubungkan ke Postgres (via pg)...');
        
        // Cek koneksi
        await pool.query('SELECT NOW()');
        
        // Buat tabel jika belum ada
        await pool.query(SCHEMA);
        console.log('✅ Skema database SQL siap');

        // Seed admin jika kosong
        const adminCheck = await pool.query('SELECT COUNT(*) FROM admins');
        if (parseInt(adminCheck.rows[0].count) === 0) {
            console.log('🌱 Seeding default admin...');
            await pool.query(
                "INSERT INTO admins (id, username, password, role) VALUES ('admin-1', 'admin', 'bhd2024', 'superadmin')"
            );
        }

        // Seed settings jika kosong
        const settingsCheck = await pool.query('SELECT COUNT(*) FROM settings');
=======

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

    try {
        console.log('⏳ Menghubungkan ke Postgres...');
        
        // Cek koneksi (menggunakan wrapper query yang mendukung mock)
        // Kita gunakan timeout pendek khusus untuk tes awal agar tidak hang lama
        await query('SELECT NOW()');
        
        // Buat tabel jika belum ada
        await query(SCHEMA);
        console.log('✅ Skema database SQL siap');

        // ── AUTO MIGRATION: Pastikan kolom baru ada (untuk sinkronisasi skema lama) ──
        console.log('🔄 Sinkronisasi kolom database (Auto-Migration)...');
        const migrations = [
            // Inventory
            { t: 'inventory', c: 'toko', type: 'TEXT' },
            { t: 'inventory', c: 'nota', type: 'TEXT' },
            { t: 'inventory', c: 'tgl_masuk', type: 'TEXT' },
            { t: 'inventory', c: 'catatan', type: 'TEXT' },
            { t: 'inventory', c: 'stok_min', type: 'INTEGER DEFAULT 5' },
            // Transactions
            { t: 'transactions', c: 'label', type: 'TEXT' },
            { t: 'transactions', c: 'sub', type: 'TEXT' },
            { t: 'transactions', c: 'kategori', type: 'TEXT' },
            { t: 'transactions', c: 'nota', type: 'TEXT' },
            { t: 'transactions', c: 'toko', type: 'TEXT' },
            { t: 'transactions', c: 'status', type: 'TEXT' },
            { t: 'transactions', c: 'posisi', type: 'TEXT' },
            { t: 'transactions', c: 'sparepart_id', type: 'TEXT' }
        ];
        for (const m of migrations) {
            try {
                // Tambah kolom jika belum ada (Safe Alter)
                await query(`ALTER TABLE ${m.t} ADD COLUMN IF NOT EXISTS ${m.c} ${m.type}`);
            } catch (err) { 
                console.warn(`⚠️ Info Migrasi (${m.t}.${m.c}): ${err.message}`); 
            }
        }
        console.log('✅ Sinkronisasi skema selesai');

        // Seed admin jika kosong
        const adminCheck = await query('SELECT COUNT(*) FROM admins');
        if (parseInt(adminCheck.rows[0].count) === 0) {
            console.log('🌱 Seeding default admin...');
            await query(
                "INSERT INTO admins (id, username, password, role, active) VALUES ('admin-1', 'admin', 'bhd2024', 'superadmin', true)"
            );
        }

        // Seed armada jika kosong
        const fleetCheck = await query('SELECT COUNT(*) FROM fleet');
        if (parseInt(fleetCheck.rows[0].count) === 0) {
            console.log('🌱 Seeding default fleet units...');
            const defaultFleet = [
                ['f1', 'B 1234 CD', 'Budi Santoso', 'jalan', '2025-07-20', '2025-07-18'],
                ['f2', 'B 5678 EF', 'Andi Pratama', 'jalan', '2025-09-15', '2025-10-01'],
                ['f3', 'B 9012 GH', 'Rudi Hartono', 'bengkel', '2025-08-05', '2025-08-10'],
                ['f4', 'B 3456 IJ', 'Sari Dewi', 'antre', '2025-07-22', '2025-07-25'],
                ['f5', 'B 7890 KL', 'Hendra Wijaya', 'jalan', '2025-12-01', '2025-11-15'],
                ['f6', 'B 2345 MN', 'Teguh Purnomo', 'jalan', '2025-10-10', '2025-09-20']
            ];
            for (const f of defaultFleet) {
                await query(
                    'INSERT INTO fleet (id, nopol, driver, status, pajak, kir) VALUES ($1, $2, $3, $4, $5, $6)',
                    f
                );
            }
        }
        const settingsCheck = await query('SELECT COUNT(*) FROM settings');
>>>>>>> main
        if (parseInt(settingsCheck.rows[0].count) === 0) {
            console.log('🌱 Seeding default settings...');
            const defaults = [
                ['company_name', 'PT. BAGUS HARYA DWIPRIMA'],
                ['fleet_count', '6'],
                ['login_username', 'admin'],
<<<<<<< HEAD
                ['login_password', 'bhd2024']
            ];
            for (const [key, val] of defaults) {
                await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, val]);
            }
        }
    } catch (e) {
        console.error('⚠ Gagal inisialisasi SQL:', e.message);
=======
                ['login_password', 'bhd2024'],
                ['admin_reg_code', 'BHD2024']
            ];
            for (const [key, val] of defaults) {
                await query('INSERT INTO settings (key, value) VALUES ($1, $2)', [key, val]);
            }
        }
    } catch (e) {
        console.error('❌ Gagal terhubung ke Database Asli:', e.message);
>>>>>>> main
        throw e;
    }
}

const db = {
    init,

    // ----- SETTINGS & AUTH -----
    getSettings: async () => {
<<<<<<< HEAD
        const { rows } = await pool.query('SELECT * FROM settings');
=======
        const { rows } = await query('SELECT * FROM settings');
>>>>>>> main
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        return settings;
    },

    updateSetting: async (key, value) => {
<<<<<<< HEAD
        await pool.query(
            'INSERT INTO settings (key, value) ON CONFLICT (key) DO UPDATE SET value = $2',
=======
        await query(
            'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
>>>>>>> main
            [key, value]
        );
    },

    validateAdmin: async (username, password) => {
<<<<<<< HEAD
        const { rows } = await pool.query(
            'SELECT * FROM admins WHERE username = $1 AND password = $2',
            [username, password]
        );
        return rows[0] || null;
=======
        const { rows } = await query(
            'SELECT * FROM admins WHERE username = $1 AND password = $2',
            [username, password]
        );
        const user = rows[0] || null;
        if (user && user.active === false) {
            throw new Error('Akun ditangguhkan (Blokir). Hubungi Superadmin.');
        }
        return user;
>>>>>>> main
    },

    registerAdmin: async (username, password, role = 'admin') => {
        const id = 'admin-' + Date.now();
<<<<<<< HEAD
        await pool.query(
            'INSERT INTO admins (id, username, password, role) VALUES ($1, $2, $3, $4)',
            [id, username, password, role]
        );
        return { id, username, role };
=======
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
>>>>>>> main
    },

    // ----- TRANSACTIONS -----
    getTransactions: async (filters = {}) => {
<<<<<<< HEAD
        let query = 'SELECT * FROM transactions WHERE 1=1';
=======
        let sql = 'SELECT * FROM transactions WHERE 1=1';
>>>>>>> main
        const params = [];
        let i = 1;

        if (filters.from) {
<<<<<<< HEAD
            query += ` AND date >= $${i++}`;
            params.push(filters.from);
        }
        if (filters.to) {
            query += ` AND date <= $${i++}`;
            params.push(filters.to);
        }
        if (filters.type) {
            query += ` AND type = $${i++}`;
            params.push(filters.type);
        }
        if (filters.armada) {
            query += ` AND armada = $${i++}`;
            params.push(filters.armada);
        }

        query += ' ORDER BY date DESC';
        const { rows } = await pool.query(query, params);
=======
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
>>>>>>> main
        return rows.map(r => ({ ...r, amount: parseInt(r.amount) }));
    },

    addTransaction: async (t) => {
<<<<<<< HEAD
        await pool.query(
=======
        await query(
>>>>>>> main
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
<<<<<<< HEAD
        const { rowCount } = await pool.query(
=======
        const { rowCount } = await query(
>>>>>>> main
            `UPDATE transactions SET ${fields.join(', ')} WHERE id = $${i}`,
            params
        );
        return rowCount > 0;
    },

    deleteTransaction: async (id) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Ambil info transaksi sebelum dihapus
            const { rows } = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);
            if (rows.length > 0) {
<<<<<<< HEAD
=======
// ... existing logic ...
>>>>>>> main
                const t = rows[0];
                // Jika ini adalah outflow onderdil yang terhubung ke stok
                if (t.type === 'outflow' && t.kategori === 'Onderdil' && t.sparepart_id) {
                    // Kembalikan stok
                    await client.query('UPDATE inventory SET stok_sisa = stok_sisa + 1 WHERE id = $1', [t.sparepart_id]);
                    // Hapus entry di inventory_installed yang sesuai
<<<<<<< HEAD
                    await client.query('DELETE FROM inventory_installed WHERE txn_id = $1 OR (inventory_id = $2 AND armada = $3 AND tgl_pasang = $4 LIMIT 1)', 
=======
                    await client.query(
                        `DELETE FROM inventory_installed WHERE id = (
                            SELECT id FROM inventory_installed 
                            WHERE txn_id = $1 OR (inventory_id = $2 AND armada = $3 AND tgl_pasang = $4)
                            LIMIT 1
                        )`,
>>>>>>> main
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

<<<<<<< HEAD
=======
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

>>>>>>> main
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
<<<<<<< HEAD
        await pool.query(
            `INSERT INTO inventory 
            (id, nama, spek, kategori, toko, nota, tgl_masuk, stok_awal, stok_sisa, harga_satuan, catatan)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [sp.id, sp.nama, sp.spek || '', sp.kategori || '', sp.toko || '', sp.nota || '', sp.tgl_masuk, sp.stok_awal, sp.stok_sisa, sp.hargaSatuan || 0, sp.catatan || '']
=======
        // Handle mapping from both camelCase (frontend legacy) and snake_case (standard)
        const harga = sp.harga_satuan !== undefined ? sp.harga_satuan : (sp.hargaSatuan || 0);
        const tgl = sp.tgl_masuk || sp.tglMasuk || '';
        const sAwal = sp.stok_awal !== undefined ? sp.stok_awal : (sp.stokAwal || 0);
        const sSisa = sp.stok_sisa !== undefined ? sp.stok_sisa : (sp.stokSisa || 0);
        const sMin = sp.stok_min !== undefined ? sp.stok_min : (sp.stokMin || 5);

        await pool.query(
            `INSERT INTO inventory 
            (id, nama, spek, kategori, toko, nota, tgl_masuk, stok_awal, stok_sisa, stok_min, harga_satuan, catatan)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [sp.id, sp.nama, sp.spek || '', sp.kategori || '', sp.toko || '', sp.nota || '', tgl, sAwal, sSisa, sMin, harga, sp.catatan || '']
>>>>>>> main
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
<<<<<<< HEAD
        const { rowCount } = await pool.query('DELETE FROM inventory WHERE id = $1', [id]);
        return rowCount > 0;
    },

=======
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // 1. Dapatkan daftar txn_id terkait pemakaian item ini
            const { rows: usages } = await client.query('SELECT txn_id FROM inventory_installed WHERE inventory_id = $1', [id]);
            const txnIds = usages.map(u => u.txn_id).filter(t => t);
            
            // 2. Hapus catatan pemakaian (install history)
            await client.query('DELETE FROM inventory_installed WHERE inventory_id = $1', [id]);
            
            // 3. Hapus transaksi keuangan terkait (outflows)
            if (txnIds.length > 0) {
                // Gunakan ANY($1) untuk array delete
                await client.query('DELETE FROM transactions WHERE id = ANY($1)', [txnIds]);
            }
            
            // 4. Akhirnya hapus master item inventory
            const { rowCount } = await client.query('DELETE FROM inventory WHERE id = $1', [id]);
            
            await client.query('COMMIT');
            return rowCount > 0;
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Force delete inventory failed:', e.message);
            throw e;
        } finally {
            client.release();
        }
    },


>>>>>>> main
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
<<<<<<< HEAD
                    'INSERT INTO inventory_installed (inventory_id, armada, tgl_pasang, ritase, txn_id) VALUES ($1, $2, $3, $4, $5)',
                    [id, installData.armada, installData.tgl_pasang, 0, installData.txnId]
=======
                    'INSERT INTO inventory_installed (inventory_id, armada, tgl_pasang, ritase, txn_id, posisi) VALUES ($1, $2, $3, $4, $5, $6)',
                    [id, installData.armada, installData.tgl_pasang, 0, installData.txnId, installData.posisi || '']
>>>>>>> main
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
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Ambil info pemasangan
            const { rows } = await client.query('SELECT * FROM inventory_installed WHERE id = $1', [installId]);
            if (rows.length === 0) throw new Error('Data pemasangan tidak ditemukan');
            
<<<<<<< HEAD
            // Hapus pemasangan
            await client.query('DELETE FROM inventory_installed WHERE id = $1', [installId]);
            
            // Kembalikan stok (asumsi per baris = 1 unit)
            await client.query('UPDATE inventory SET stok_sisa = stok_sisa + 1 WHERE id = $1', [id]);
=======
            const txnId = rows[0].txn_id;

            // 1. Hapus catatan terpasang
            await client.query('DELETE FROM inventory_installed WHERE id = $1', [installId]);
            
            // 2. Kembalikan stok
            await client.query('UPDATE inventory SET stok_sisa = stok_sisa + 1 WHERE id = $1', [id]);

            // 3. Hapus transaksi terkait jika ada
            if (txnId) {
                await client.query('DELETE FROM transactions WHERE id = $1', [txnId]);
            }
>>>>>>> main
            
            await client.query('COMMIT');
            return true;
        } catch (e) {
            await client.query('ROLLBACK');
<<<<<<< HEAD
=======
            console.error('Uninstall failure:', e.message);
>>>>>>> main
            return false;
        } finally {
            client.release();
        }
    },
<<<<<<< HEAD
};

module.exports = db;
=======

    // ----- SETTINGS -----
    getSettings: async (key) => {
        const sql = key ? 'SELECT * FROM settings WHERE key = $1' : 'SELECT * FROM settings';
        const { rows } = await query(sql, key ? [key] : []);
        if (key) return rows[0] || null;
        // Return as object {key: value} if no key provided
        return rows.reduce((acc, r) => { acc[r.key] = r.value; return acc; }, {});
    },

    upsertSetting: async (key, value) => {
        const sql = `
            INSERT INTO settings (key, value) VALUES ($1, $2)
            ON CONFLICT (key) DO UPDATE SET value = $2
        `;
        await query(sql, [key, value]);
        return true;
    },

    resetTransactions: async () => {

        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // 1. Clear usage history
            await client.query('DELETE FROM inventory_installed');
            // 2. Clear transactions
            await client.query('DELETE FROM transactions');
            // 3. Reset stocks to initial values
            await client.query('UPDATE inventory SET stok_sisa = stok_awal');
            // 4. (Optional) Clear audit logs? Let's keep them for now as they are system records.
            await client.query('COMMIT');
            return true;
        } catch (e) {
            await client.query('ROLLBACK');
            console.error('Reset failed:', e.message);
            throw e;
        } finally {
            client.release();
        }
    },


};

const exportedDb = {
    ...db,
    init,
    query,
    isMock: () => false
};

module.exports = exportedDb;
>>>>>>> main
