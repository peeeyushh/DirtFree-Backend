import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { globalLimiter } from './middleware/rateLimiter.js';
import logger from './config/logger.js';
import { getLatestQR } from './services/whatsapp.js';
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
  if (!qr) {
    return res.send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h2>WhatsApp is already logged in or not initialized yet.</h2>
        <p>If you need to re-login, restart the server.</p>
      </div>
    `);
  }

  try {
    const qrImage = await QRCode.toDataURL(qr);
    res.send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h1 style="color: #25D366;">DirtFree WhatsApp Login</h1>
        <p>Scan this QR code with your WhatsApp to enable notifications.</p>
        <img src="${qrImage}" style="border: 10px solid #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.1); border-radius: 20px;" />
        <p style="color: #666; margin-top: 20px;">Refreshing this page will show the latest code.</p>
      </div>
    `);
  } catch (err) {
    res.status(500).send('Error generating QR code');
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
