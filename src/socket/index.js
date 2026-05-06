import { Server } from 'socket.io';
import logger from '../config/logger.js';
import { auth } from '../config/firebase.js';

export const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*", // Adjust this in production to your domain
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
  });

  // Security Middleware: Socket Authentication
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token && process.env.NODE_ENV === 'production') {
      return next(new Error('Authentication error: Token missing'));
    }

    if (token && auth) {
      try {
        const decodedToken = await auth.verifyIdToken(token);
        socket.user = decodedToken;
        logger.info(`🔐 Authenticated: ${decodedToken.email}`);
        return next();
      } catch (error) {
        logger.error('❌ Socket Auth Error:', error.message);
        return next(new Error('Authentication error: Invalid token'));
      }
    }

    // Allow in dev without token if not configured
    next();
  });

  io.on('connection', (socket) => {
    logger.info(`🔌 New connection: ${socket.id} (${socket.user?.email || 'Anonymous'})`);

    // Dynamic Room Joining based on role
    socket.on('register', (data) => {
      if (data.role === 'partner') {
        socket.join('partners');
        logger.info(`👷 Partner ${data.id} joined partners room`);
      }
    });

    socket.on('updateLocation', (data) => {
      // Broadcast to specific rooms or customers if needed
      // logger.info(`📍 Location from ${socket.id}: ${data.lat}, ${data.lng}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info(`👋 Disconnected: ${socket.id} Reason: ${reason}`);
    });
  });

  return io;
};
