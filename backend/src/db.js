import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;

// Configure SSL dynamically:
// Render, Neon, Supabase require SSL. Local Postgres typically does not.
const isLocal = !databaseUrl || databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

export const pool = new Pool({
  connectionString: databaseUrl || 'postgresql://postgres:postgres@localhost:5432/ekaly',
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected idle client error:', err.message);
});

export const query = (text, params) => pool.query(text, params);

/**
 * Initializes tables and default records automatically on startup.
 * Guarantees zero-config setup on Render.
 */
export async function initDatabase() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  console.log('[PostgreSQL] Checking and executing database schema migrations...');
  try {
    await pool.query(schemaSql);
    console.log('[PostgreSQL] Database tables and indexes are ready.');
  } catch (error) {
    console.error('[PostgreSQL] Schema migration error:', error);
    throw error;
  }
}
