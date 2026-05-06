import { db } from '../config/firebase.js';
import logger from '../config/logger.js';

export const startDispatcher = (io) => {
  if (!db) {
    logger.error('❌ Firestore not initialized. Dispatcher cannot start.');
    return;
  }

  logger.info('🛰️ Booking Dispatcher started...');

  // Listen for new bookings with status 'searching'
  db.collection('bookings')
    .where('status', '==', 'searching')
    .onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const booking = { id: change.doc.id, ...change.doc.data() };
          
          // Only notify if it's still searching and hasn't been notified yet (optional throttle)
          if (booking.status === 'searching' && !booking.workerId) {
            const isUrgent = booking.items?.some(item => item.isUrgent) || !!booking.isUrgent;
            logger.info(`🆕 New booking found: ${booking.id} (Urgent: ${isUrgent}). Broadcasting...`);
            
            // Broadcast to all partners in the 'partners' room
            io.to('partners').emit('newNearbyBooking', {
              id: booking.id,
              serviceName: booking.serviceName || (booking.items && booking.items[0]?.serviceName) || 'Service Request',
              location: booking.location,
              userAddress: booking.userAddress,
              isUrgent: isUrgent,
              timestamp: new Date()
            });
          }
        }
      });
    }, (error) => {
      logger.error('❌ Dispatcher Snapshot Error:', error);
    });
};
