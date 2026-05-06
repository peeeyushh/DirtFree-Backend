import admin from 'firebase-admin';
import logger from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

try {
  // Production mein Render par hum Service Account JSON ko stringified env var mein rakhenge
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    logger.info('✅ Firebase Admin Initialized');
  } else {
    logger.warn('⚠️ Firebase Service Account not found. Auth verification will be skipped in DEV.');
  }
} catch (error) {
  logger.error('❌ Firebase Initialization Error:', error);
}

export const auth = admin.apps.length ? admin.auth() : null;
export const db = admin.apps.length ? admin.firestore() : null;
export default admin;
