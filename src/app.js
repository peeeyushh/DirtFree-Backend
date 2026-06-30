import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { globalLimiter } from './middleware/rateLimiter.js';
import logger from './config/logger.js';
import paymentRouter from './routes/paymentRoutes.js';
import subscriptionRouter from './routes/subscriptionRoutes.js';
const app = express();

// Security Middleware
app.use(helmet()); // Sets various HTTP headers for security
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS === '*' ? '*' : (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*'),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));
app.use(globalLimiter); // Protects against DDoS
app.use(express.json());

// Routes
app.use('/payments', paymentRouter);
app.use('/subscriptions', subscriptionRouter);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

export default app;
