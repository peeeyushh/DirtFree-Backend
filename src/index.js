import http from 'http';
import dotenv from 'dotenv';
import app from './app.js';
import { initSocket } from './socket/index.js';
import logger from './config/logger.js';

dotenv.config();

const server = http.createServer(app);
const io = initSocket(server);

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Graceful Shutdown
const shutdown = () => {
  logger.info('🛑 Shutting down server...');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
