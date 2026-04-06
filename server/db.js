import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getDb() {
  return open({
    filename: path.join(__dirname, 'database.sqlite'),
    driver: sqlite3.Database
  });
}

export async function initDb() {
  const db = await getDb();
  await db.exec(`
    CREATE TABLE IF NOT EXISTS urls (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      ownerName TEXT,
      ownerSoeid TEXT,
      ownerEmail TEXT,
      pageType TEXT,
      status TEXT,
      expiryDate TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
  console.log('Database initialized');
  return db;
}
