import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const caPath = path.join(__dirname, '../../certs/aiven-ca.pem');

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agri_monitor',
  ssl: process.env.DB_SSL === 'true' ? { ca: fs.readFileSync(caPath) } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  timezone: 'local',
});

export const q = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};
