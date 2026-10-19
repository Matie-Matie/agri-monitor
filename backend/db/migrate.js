/**
 * Non-destructive migration for databases that already hold data (e.g. the live one).
 * Idempotent: checks information_schema before every change, works on MariaDB and MySQL 8.
 * `npm run db:migrate`   (schema.sql is for fresh installs only: it DROPs tables.)
 */
import mysql from 'mysql2/promise';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const db = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agri_monitor',
  ssl: process.env.DB_SSL === 'true' ? { ca: fs.readFileSync(path.join(__dirname, '../certs/aiven-ca.pem')) } : undefined,
});

const dbName = process.env.DB_NAME || 'agri_monitor';
const one = async (sql, p = []) => (await db.query(sql, p))[0][0];

const hasTable = async (t) =>
  !!(await one('SELECT 1 AS x FROM information_schema.tables WHERE table_schema=? AND table_name=?', [dbName, t]));
const hasColumn = async (t, c) =>
  !!(await one('SELECT 1 AS x FROM information_schema.columns WHERE table_schema=? AND table_name=? AND column_name=?', [dbName, t, c]));

async function addColumn(table, column, ddl) {
  if (await hasColumn(table, column)) return console.log(`  · ${table}.${column} exists`);
  await db.query(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
  console.log(`  + ${table}.${column}`);
}

console.log('▶ Migrating (001 panel revisions)...');

if (!(await hasTable('customers'))) {
  await db.query(`CREATE TABLE customers (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name       VARCHAR(150)    NOT NULL,
    phone      VARCHAR(40)     NULL,
    created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_customers_name (name)
  ) ENGINE=InnoDB`);
  console.log('  + customers');
} else console.log('  · customers exists');

await addColumn('sales', 'customer_id', 'customer_id BIGINT UNSIGNED NULL AFTER user_id');
await addColumn('sales', 'payment_status', "payment_status ENUM('paid','unpaid') NOT NULL DEFAULT 'paid' AFTER payment_method");
await addColumn('sales', 'amount_paid', 'amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER payment_status');
await addColumn('sales', 'paid_at', 'paid_at TIMESTAMP NULL DEFAULT NULL AFTER amount_paid');
await addColumn('batches', 'supplier_id', 'supplier_id BIGINT UNSIGNED NULL AFTER product_id');

const hasFk = async (t, name) =>
  !!(await one('SELECT 1 AS x FROM information_schema.table_constraints WHERE table_schema=? AND table_name=? AND constraint_name=?', [dbName, t, name]));
if (!(await hasFk('sales', 'fk_sales_customer'))) {
  await db.query('ALTER TABLE sales ADD CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL');
  console.log('  + fk_sales_customer');
}
if (!(await hasFk('batches', 'fk_batches_supplier'))) {
  await db.query('ALTER TABLE batches ADD CONSTRAINT fk_batches_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL');
  console.log('  + fk_batches_supplier');
}

// Backfills (only touch rows that haven't been set yet)
const [a] = await db.query("UPDATE sales SET amount_paid = total_amount, paid_at = created_at WHERE payment_status = 'paid' AND paid_at IS NULL");
const [b] = await db.query('UPDATE batches b JOIN products p ON p.id = b.product_id SET b.supplier_id = p.supplier_id WHERE b.supplier_id IS NULL AND p.supplier_id IS NOT NULL');
console.log(`  ↻ backfilled ${a.affectedRows} sales as paid, ${b.affectedRows} batches with supplier`);

await db.end();
console.log('✅ Migration complete');
