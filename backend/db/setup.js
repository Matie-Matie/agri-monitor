/**
 * One-step database setup used by start.bat (safe to run on every launch).
 *  - database/tables missing  -> create everything + demo data (db/seed.js)
 *  - database already there   -> apply pending updates only (db/migrate.js), data untouched
 * Exit codes: 0 ok, 2 = MySQL not reachable, 1 = anything else.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const cfg = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
};
const dbName = process.env.DB_NAME || 'agri_monitor';

let conn;
for (let i = 0; i < 20 && !conn; i++) {
  try { conn = await mysql.createConnection(cfg); } catch { await new Promise((r) => setTimeout(r, 1000)); }
}
if (!conn) {
  console.error(`Cannot reach MySQL at ${cfg.host}:${cfg.port}`);
  process.exit(2);
}

try {
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = ? AND table_name = 'users'",
    [dbName]
  );
  await conn.end();
  if (rows[0].c === 0) {
    console.log('First run: creating the database and demo data...');
    await import('./seed.js');
  } else {
    await import('./migrate.js');
  }
} catch (e) {
  console.error('Database setup failed:', e.message);
  process.exit(1);
}
