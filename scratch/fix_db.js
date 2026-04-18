const fs = require('fs');
const { Pool } = require('pg');

const enc = fs.readFileSync('.env', 'utf8');
const match = enc.match(/(DATABASE_URL|POSTGRES_URL)="([^"]+)"/);
if (!match) { console.error("URL not found"); process.exit(1); }

const pool = new Pool({ connectionString: match[2] });

pool.query("ALTER TABLE inventory_installed ADD COLUMN posisi TEXT")
  .then(() => console.log("SUCCESS: Column added"))
  .catch(e => console.log("Note:", e.message))
  .finally(() => process.exit());
