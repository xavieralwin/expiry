import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { initDb } from './db.js';

const app = express();
// Use standard 3001 locally or PORT from env, but let's stick to 8080 if environment provides it
const PORT = process.env.PORT || 3001;

// Fully permissive CORS since frontend URL might be dynamic
app.use(cors());
app.use(express.json({ limit: '50mb' }));

let db;

initDb().then(database => {
  db = database;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error("Failed to initialize database", err);
});

// GET /api/urls
app.get('/api/urls', async (req, res) => {
  try {
    const urls = await db.all('SELECT * FROM urls ORDER BY createdAt DESC');
    res.json(urls);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch URLs' });
  }
});

// POST /api/urls
app.post('/api/urls', async (req, res) => {
  try {
    const id = req.body.id || uuidv4();
    const now = new Date().toISOString();
    const { url, ownerName, ownerSoeid, ownerEmail, pageType, status, expiryDate } = req.body;
    
    await db.run(
      `INSERT INTO urls (id, url, ownerName, ownerSoeid, ownerEmail, pageType, status, expiryDate, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, url, ownerName, ownerSoeid, ownerEmail, pageType, status, expiryDate, now, now]
    );
    
    const newRecord = await db.get('SELECT * FROM urls WHERE id = ?', id);
    res.status(201).json(newRecord);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create URL' });
  }
});

// PUT /api/urls/:id
app.put('/api/urls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const now = new Date().toISOString();
    const { url, ownerName, ownerSoeid, ownerEmail, pageType, status, expiryDate } = req.body;
    
    await db.run(
      `UPDATE urls SET url = ?, ownerName = ?, ownerSoeid = ?, ownerEmail = ?, pageType = ?, status = ?, expiryDate = ?, updatedAt = ? WHERE id = ?`,
      [url, ownerName, ownerSoeid, ownerEmail, pageType, status, expiryDate, now, id]
    );
    
    const updatedRecord = await db.get('SELECT * FROM urls WHERE id = ?', id);
    res.json(updatedRecord);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update URL' });
  }
});

// DELETE /api/urls/:id
app.delete('/api/urls/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM urls WHERE id = ?', id);
    res.json({ success: true, id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete URL' });
  }
});

// POST /api/urls/batch
app.post('/api/urls/batch', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid items array' });
    }
    
    const now = new Date().toISOString();
    
    await db.run('BEGIN TRANSACTION');
    
    for (const item of items) {
      const id = item.id || uuidv4();
      await db.run(
        `INSERT INTO urls (id, url, ownerName, ownerSoeid, ownerEmail, pageType, status, expiryDate, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, item.url, item.ownerName, item.ownerSoeid, item.ownerEmail, item.pageType, item.status, item.expiryDate, now, now]
      );
    }
    
    await db.run('COMMIT');
    res.json({ success: true, count: items.length });
  } catch (error) {
    await db.run('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Failed to batch insert URLs' });
  }
});
