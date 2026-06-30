import 'dotenv/config';
import { db } from './src/config/firebase.js';

async function seed() {
  try {
    const subRef = db.collection('subscriptions').doc();
    await subRef.set({
      bookingId: 'MOCK_BOOKING_ID',
      customerId: 'mock_user_123',
      customerName: 'Mock Agrawala',
      frequency: 'daily_1_week',
      status: 'active',
      createdAt: new Date()
    });

    for (let i = 0; i < 3; i++) {
      await db.collection('serviceTasks').add({
        subscriptionId: subRef.id,
        bookingId: 'MOCK_BOOKING_ID',
        customerId: 'mock_user_123',
        assignedPartnerId: null,
        status: 'pending_reassignment',
        date: new Date().toISOString(),
        createdAt: new Date()
      });
    }
    console.log('Mock subscription created with ID:', subRef.id);
  } catch (err) {
    console.error('Error seeding:', err);
  }
  process.exit(0);
}

seed();
