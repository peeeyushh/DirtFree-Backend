import { Server } from 'socket.io';
import logger from '../config/logger.js';
import { auth, db } from '../config/firebase.js';

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
      const { partnerId, latitude, longitude, isOnline } = data;
      if (!partnerId) return;

      // Broadcast location to anyone tracking this partner (e.g., customers)
      io.to(`tracking_${partnerId}`).emit('partnerLocationUpdate', {
        partnerId,
        latitude,
        longitude,
        isOnline,
        timestamp: new Date()
      });
      
      // logger.info(`📍 Location from Partner ${partnerId}: ${latitude}, ${longitude}`);
    });

    // Room for customers to track a specific partner
    socket.on('joinTracking', (partnerId) => {
      socket.join(`tracking_${partnerId}`);
      logger.info(`👥 Client ${socket.id} started tracking partner ${partnerId}`);
    });

    // Partner accepts a booking
    socket.on('acceptBooking', async (data) => {
      const { bookingId, partnerId, partnerName } = data;
      
      if (!db) return;

      try {
        const bookingRef = db.collection('bookings').doc(bookingId);
        
        // Use a transaction to ensure only one partner can accept
        await db.runTransaction(async (t) => {
          const doc = await t.get(bookingRef);
          if (!doc.exists) throw new Error('Booking not found');
          
          const bookingData = doc.data();
          if (bookingData.status !== 'searching') {
            throw new Error('Booking already accepted by someone else');
          }

          t.update(bookingRef, {
            status: 'accepted',
            workerId: partnerId,
            workerName: partnerName,
            acceptedAt: new Date(),
          });
        });

        logger.info(`✅ Booking ${bookingId} accepted by Partner ${partnerId}`);
        socket.emit('bookingAcceptedSuccess', { bookingId });
        
        // Notify the customer (if they are in the tracking room)
        io.to(`tracking_${partnerId}`).emit('partnerAssigned', { 
          partnerId, 
          partnerName 
        });

      } catch (error) {
        logger.error(`❌ Accept Booking Error: ${error.message}`);
        socket.emit('acceptBookingError', { message: error.message });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`👋 Disconnected: ${socket.id} Reason: ${reason}`);
    });
  });

  return io;
};
