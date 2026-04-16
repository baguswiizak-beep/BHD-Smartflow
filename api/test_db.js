const { Client } = require('pg');

const connectionString = 'postgresql://postgres.fwuuhtmwhgisrkbtmasi:bagus07Juli2001@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function testConnection() {
  try {
    console.log('⏳ Menghubungkan ke Transaction Pooler...');
    await client.connect();
    console.log('✅ Koneksi BERHASIL!');
    const res = await client.query('SELECT NOW()');
    console.log('🕒 Waktu Database:', res.rows[0].now);
    
    // Test fetch settings table
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('📊 Tabel ditemukan:', tables.rows.map(r => r.table_name).join(', '));
    
    await client.end();
  } catch (err) {
    console.error('❌ Koneksi GAGAL:', err.message);
    process.exit(1);
  }
}

testConnection();
