import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { initDb } from './db.js';
import nodemailer from 'nodemailer';

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
    const { url, landingUrl, ownerName, ownerSoeid, ownerEmail, pageType, status, expiryDate, environment, jiraNo } = req.body;
    
    await db.run(
      `INSERT INTO urls (id, url, landingUrl, ownerName, ownerSoeid, ownerEmail, pageType, status, expiryDate, environment, jiraNo, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, url, landingUrl, ownerName, ownerSoeid, ownerEmail, pageType, status, expiryDate, environment || 'ICMS', jiraNo, now, now]
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
    const { url, landingUrl, ownerName, ownerSoeid, ownerEmail, pageType, status, expiryDate, environment, jiraNo } = req.body;
    
    await db.run(
      `UPDATE urls SET url = ?, landingUrl = ?, ownerName = ?, ownerSoeid = ?, ownerEmail = ?, pageType = ?, status = ?, expiryDate = ?, environment = ?, jiraNo = ?, updatedAt = ? WHERE id = ?`,
      [url, landingUrl, ownerName, ownerSoeid, ownerEmail, pageType, status, expiryDate, environment || 'ICMS', jiraNo, now, id]
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
        `INSERT INTO urls (id, url, landingUrl, ownerName, ownerSoeid, ownerEmail, pageType, status, expiryDate, environment, jiraNo, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, item.url, item.landingUrl, item.ownerName, item.ownerSoeid, item.ownerEmail, item.pageType, item.status, item.expiryDate, item.environment || 'ICMS', item.jiraNo, now, now]
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

// POST /api/urls/notify
app.post('/api/urls/notify', async (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'No records provided' });
    }

    // SMTP configuration from environment variables
    let transporter;
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.ethereal.email',
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER, 
          pass: process.env.SMTP_PASS, 
        },
      });
    } else {
      // Fallback to auto-generated test account for local testing
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    }

    // Send to specific admin people as requested
    const adminEmails = process.env.ADMIN_EMAIL_RECIPIENTS || 'alwin@xerago.com';

    // Generate HTML for the email
    const rowsHtml = records.map(r => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; word-break: break-all;">
          <a href="${r.url}" style="color: #a78bfa; text-decoration: none;">${r.url}</a>
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569; word-wrap: break-word;">${r.ownerName || '-'}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #475569; word-wrap: break-word;">${r.ownerEmail || '-'}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #f97316; font-weight: bold; white-space: nowrap;">
          ${r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : '-'}
        </td>
      </tr>
    `).join('');

    const htmlBody = `
      <div style="font-family: 'Inter', Arial, sans-serif; background-color: #f8fafc; padding: 40px 20px; font-size: 14px;">
        <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <h2 style="color: #f97316; margin-top: 0; font-size: 20px;">
            🚨 Action Required: Expiring URLs
          </h2>
          <p style="color: #475569; font-size: 14px; line-height: 1.5;">The following URLs are expiring soon and require your review:</p>
          
          <table style="width: 100%; border-collapse: collapse; text-align: left; margin: 24px 0; table-layout: fixed;">
            <thead>
              <tr style="background-color: #f8fafc;">
                <th style="width: 45%; padding: 10px 14px; border-bottom: 2px solid #e2e8f0; font-size: 13px; color: #1e293b; font-weight: 600;">URL</th>
                <th style="width: 25%; padding: 10px 14px; border-bottom: 2px solid #e2e8f0; font-size: 13px; color: #1e293b; font-weight: 600;">Content Owner</th>
                <th style="width: 15%; padding: 10px 14px; border-bottom: 2px solid #e2e8f0; font-size: 13px; color: #1e293b; font-weight: 600;">Owner Email</th>
                <th style="width: 15%; padding: 10px 14px; border-bottom: 2px solid #e2e8f0; font-size: 13px; color: #1e293b; font-weight: 600;">Expiry Date</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          
          <p style="color: #475569; font-size: 14px; line-height: 1.5; margin-bottom: 32px;">Please take action to renew or delete these pages in the system.</p>
          
          <div style="font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 24px;">
            This is an automated notification from the URL Expiry Tracker.
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.SMTP_FROM || '"URL Expiry Tracker" <noreply@example.com>',
      to: adminEmails,
      subject: `[Alert] ${records.length} URLs Expiring Soon`,
      html: htmlBody,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);

    // For ethereal email testing (if no credentials provided, nodemailer provides test URLs)
    let previewUrl = '';
    if (!process.env.SMTP_USER || process.env.SMTP_HOST === 'smtp.ethereal.email') {
       previewUrl = nodemailer.getTestMessageUrl(info);
       console.log("Preview URL: %s", previewUrl);
    }

    res.json({ success: true, messageId: info.messageId, previewUrl });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ error: 'Failed to send emails. Check your SMTP configuration.' });
  }
});
