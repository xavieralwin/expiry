import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs'; 
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getDb() {
  let dbPath = process.env.DB_PATH;
  if (!dbPath) {
    if (process.platform === 'win32' || !fs.existsSync('/app/data')) {
      dbPath = path.join(__dirname, '../data/database.sqlite');
    } else {
      dbPath = '/app/data/database.sqlite';
    }
  }

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });
  await db.run("PRAGMA busy_timeout = 5000");
  await db.run("PRAGMA journal_mode = WAL");
  return db;
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
      updatedAt TEXT,
      environment TEXT
    )
  `);

  const tableInfo = await db.all("PRAGMA table_info(urls)");
  const hasEnvironment = tableInfo.some(col => col.name === 'environment');
  if (!hasEnvironment) {
    await db.exec("ALTER TABLE urls ADD COLUMN environment TEXT DEFAULT 'ICMS'");
  }

  const hasLandingUrl = tableInfo.some(col => col.name === 'landingUrl');
  if (!hasLandingUrl) {
    await db.exec("ALTER TABLE urls ADD COLUMN landingUrl TEXT");
  }

  const hasJiraNo = tableInfo.some(col => col.name === 'jiraNo');
  if (!hasJiraNo) {
    await db.exec("ALTER TABLE urls ADD COLUMN jiraNo TEXT");
  }

  const hasChgNo = tableInfo.some(col => col.name === 'chgNo');
  if (!hasChgNo) {
    await db.exec("ALTER TABLE urls ADD COLUMN chgNo TEXT");
  }

  const hasReleaseDate = tableInfo.some(col => col.name === 'releaseDate');
  if (!hasReleaseDate) {
    await db.exec("ALTER TABLE urls ADD COLUMN releaseDate TEXT");
  }

  const hasWmrNo = tableInfo.some(col => col.name === 'wmrNo');
  if (!hasWmrNo) {
    await db.exec("ALTER TABLE urls ADD COLUMN wmrNo TEXT");
  }

  // MA Leaves Table Creation
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ma_leaves (
      id TEXT PRIMARY KEY,
      seoId TEXT NOT NULL,
      idName TEXT NOT NULL,
      mappingIds TEXT,
      fromDate TEXT,
      toDate TEXT,
      applied TEXT DEFAULT 'Done',
      maStatus TEXT DEFAULT 'Not started',
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  // Seed default MA leaves if empty
  const countObj = await db.get("SELECT COUNT(*) as count FROM ma_leaves");
  if (countObj && countObj.count === 0) {
    const seedData = [
      { id: 'ma-1', seoId: 'AJ26015', idName: 'Alwin', mappingIds: 'Project', fromDate: '03-09-2026', toDate: '03-13-2026', applied: 'Done', maStatus: 'Completed' },
      { id: 'ma-2', seoId: 'am28856', idName: 'Asaithambi', mappingIds: 'Moenage', fromDate: '03-16-2026', toDate: '03-20-2026', applied: 'Done', maStatus: 'Completed' },
      { id: 'ma-3', seoId: 'AV90366', idName: 'Arun Kumar', mappingIds: 'BAU', fromDate: '04-13-2026', toDate: '04-17-2026', applied: 'Done', maStatus: 'Completed' },
      { id: 'ma-4', seoId: 'Dj26014', idName: 'Dhanya', mappingIds: 'MC', fromDate: '05-04-2026', toDate: '05-08-2026', applied: 'Done', maStatus: 'Completed' },
      { id: 'ma-5', seoId: 'DS13421', idName: 'Deepika', mappingIds: 'MboL', fromDate: '05-11-2026', toDate: '05-15-2026', applied: 'Done', maStatus: 'Completed' },
      { id: 'ma-6', seoId: 'KA10005', idName: 'Ankit', mappingIds: 'Moenage', fromDate: '06-08-2026', toDate: '06-12-2026', applied: 'Done', maStatus: 'Completed' },
      { id: 'ma-7', seoId: 'mm33844', idName: 'Mahadevi', mappingIds: 'BAU', fromDate: '07-06-2026', toDate: '07-10-2026', applied: 'Done', maStatus: 'Completed' },
      { id: 'ma-8', seoId: 'nc70471', idName: 'Naveen', mappingIds: 'Project', fromDate: '07-13-2026', toDate: '07-17-2026', applied: 'Done', maStatus: 'Completed' },
      { id: 'ma-9', seoId: 'Pg52851', idName: 'Prem Kumar', mappingIds: 'BAU', fromDate: '08-03-2026', toDate: '08-07-2026', applied: 'Done', maStatus: 'Completed' },
      { id: 'ma-10', seoId: 'ps09955', idName: 'Sunil Jagtap, Pratik', mappingIds: 'BAU', fromDate: '08-10-2026', toDate: '08-14-2026', applied: 'Done', maStatus: 'Completed' },
      { id: 'ma-11', seoId: 'SM39849', idName: 'Santhosh', mappingIds: 'BAU', fromDate: '09-14-2026', toDate: '09-18-2026', applied: 'Done', maStatus: 'Ongoing' },
      { id: 'ma-12', seoId: 'vb55549', idName: 'Vasanthakumar', mappingIds: 'Moenage', fromDate: '10-12-2026', toDate: '10-16-2026', applied: 'Done', maStatus: 'Not started' },
      { id: 'ma-13', seoId: 'TR71869', idName: 'Tamilarasi Rathinavelu', mappingIds: '', fromDate: '', toDate: '', applied: '', maStatus: 'Not started' }
    ];

    const now = new Date().toISOString();
    for (const item of seedData) {
      await db.run(
        `INSERT INTO ma_leaves (id, seoId, idName, mappingIds, fromDate, toDate, applied, maStatus, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.id, item.seoId, item.idName, item.mappingIds, item.fromDate, item.toDate, item.applied, item.maStatus, now, now]
      );
    }
    console.log('Seeded initial MA leaves');
  }

  console.log('Database initialized');
  return db;
}
