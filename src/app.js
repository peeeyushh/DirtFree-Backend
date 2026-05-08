import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { globalLimiter } from './middleware/rateLimiter.js';
import logger from './config/logger.js';
import { getLatestQR, getWhatsAppStatus } from './services/whatsapp.js';
import QRCode from 'qrcode';

const app = express();

// Security Middleware
app.use(helmet()); // Sets various HTTP headers for security
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST']
}));
app.use(globalLimiter); // Protects against DDoS
app.use(express.json());

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// WhatsApp QR Exposure (for Render Free tier)
app.get('/qr', async (req, res) => {
  const qr = getLatestQR();
  const status = getWhatsAppStatus();
  
  const statusColors = {
    'INITIALIZING': '#FFA500',
    'QR_READY': '#25D366',
    'AUTHENTICATED': '#34B7F1',
    'FAILED': '#FF3B30'
  };

  const statusMessages = {
    'INITIALIZING': 'Backend is warming up... Browser is starting.',
    'QR_READY': 'WhatsApp is ready! Scan the code below.',
    'AUTHENTICATED': 'Connected! WhatsApp is live and monitoring requests.',
    'FAILED': 'Initialization failed. Please check server logs.'
  };

  let content = '';

  if (status === 'QR_READY' && qr) {
    try {
      const qrImage = await QRCode.toDataURL(qr);
      content = `
        <img src="${qrImage}" style="border: 10px solid #fff; box-shadow: 0 15px 35px rgba(0,0,0,0.2); border-radius: 24px; width: 300px; height: 300px;" />
        <p style="color: #666; margin-top: 20px; font-weight: 500;">Open WhatsApp on your phone > Linked Devices > Link a Device</p>
      `;
    } catch (err) {
      content = '<p style="color: red;">Error generating QR code.</p>';
    }
  } else if (status === 'AUTHENTICATED') {
    content = `
      <div style="background: #e1f5fe; color: #01579b; padding: 20px; border-radius: 16px; display: inline-block;">
        <p style="font-weight: bold; margin: 0;">✅ Logged in successfully!</p>
        <p style="margin-top: 5px; opacity: 0.8;">You can close this tab now.</p>
      </div>
    `;
  } else {
    content = `
      <div style="padding: 40px;">
        <div style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid ${statusColors[status]}; border-radius: 50%; animate: spin 1s linear infinite; margin: 0 auto;"></div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
      </div>
    `;
  }

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>DirtFree | WhatsApp Setup</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fdfdfd; margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; }
          .card { background: white; padding: 40px; border-radius: 40px; box-shadow: 0 20px 50px rgba(0,0,0,0.05); text-align: center; max-width: 400px; width: 90%; border: 1px solid #f0f0f0; }
          h1 { font-size: 24px; font-weight: 800; margin-bottom: 8px; color: #1a1a1a; }
          .status-badge { display: inline-block; padding: 6px 12px; border-radius: 100px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px; }
          .message { color: #888; font-size: 14px; margin-bottom: 32px; line-height: 1.5; }
        </style>
        <script>setTimeout(() => { if("${status}" !== "AUTHENTICATED") window.location.reload(); }, 5000);</script>
      </head>
      <body>
        <div class="card">
          <div class="status-badge" style="background: ${statusColors[status]}20; color: ${statusColors[status]};">${status}</div>
          <h1>WhatsApp Setup</h1>
          <p class="message">${statusMessages[status]}</p>
          ${content}
          <p style="font-size: 10px; color: #ccc; margin-top: 40px;">DIRTFREE SYSTEM • AUTO-REFRESHING EVERY 5S</p>
        </div>
      </body>
    </html>
  `);
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
