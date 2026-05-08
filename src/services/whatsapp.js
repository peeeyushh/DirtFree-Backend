import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { db } from '../config/firebase.js';
import logger from '../config/logger.js';

let client;

export const initWhatsApp = () => {
    logger.info('📱 Initializing WhatsApp Client...');
    
    client = new Client({
        authStrategy: new LocalAuth({
            clientId: "dirtfree-admin",
            dataPath: './.wwebjs_auth'
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', (qr) => {
        logger.info('📲 ACTION REQUIRED: Scan the QR code below with your WhatsApp to enable notifications:');
        qrcode.generate(qr, { small: true });
    });

    client.on('ready', () => {
        logger.info('✅ WhatsApp Client is ready and logged in!');
        startListeningToRequests();
    });

    client.on('authenticated', () => {
        logger.info('🔓 WhatsApp Authentication successful');
    });

    client.on('auth_failure', (msg) => {
        logger.error('❌ WhatsApp Authentication failure:', msg);
    });

    client.initialize().catch(err => {
        logger.error('❌ Error initializing WhatsApp:', err);
    });
};

const startListeningToRequests = () => {
    if (!db) {
        logger.warn('⚠️ Firestore not initialized. WhatsApp listener skipped.');
        return;
    }

    logger.info('👂 Listening for new Location Requests in Firestore...');
    
    // Check for requests added after the server started
    const startTime = new Date();

    db.collection('location_requests')
        .where('timestamp', '>', startTime)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data();
                    logger.info(`📍 New Request detected for ${data.city || 'Unknown'}`);
                    sendNotification(data);
                }
            });
        }, err => {
            logger.error('❌ Firestore listener error:', err);
        });
};

const sendNotification = (data) => {
    if (!client) return;

    const message = `🚀 *DirtFree: New Launch Request!* \n\n` +
                    `📍 *City:* ${data.city || 'Unknown'}\n` +
                    `🗺️ *State:* ${data.region || 'Unknown'}\n` +
                    `🏠 *Address:* ${data.address || 'N/A'}\n` +
                    `⏰ *Time:* ${new Date().toLocaleString('en-IN')}\n\n` +
                    `_Open your dashboard to see aggregated insights._`;
    
    // Get admin number from env
    const adminNumber = process.env.ADMIN_WHATSAPP_NUMBER;
    
    if (adminNumber) {
        // Clean number (remove +, spaces, etc) and append @c.us
        const cleanNumber = adminNumber.replace(/\D/g, '');
        client.sendMessage(`${cleanNumber}@c.us`, message)
            .then(() => logger.info(`📩 WhatsApp notification sent to ${cleanNumber}`))
            .catch(err => logger.error('❌ Failed to send WhatsApp message:', err));
    } else {
        logger.warn('⚠️ No ADMIN_WHATSAPP_NUMBER set in .env. Notification not sent.');
    }
};
