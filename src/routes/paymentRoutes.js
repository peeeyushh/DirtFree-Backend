import express from 'express';
import Razorpay from 'razorpay';
import logger from '../config/logger.js';

const router = express.Router();

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dv8v2kniy',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret_change_me'
});

router.post('/create-order', async (req, res, next) => {
  try {
    const { amount, bookingId } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }

    logger.info(`[Razorpay] Creating order for amount: ${amount}, booking: ${bookingId}`);

    // Create an order in Razorpay
    const options = {
      amount: Math.round(Number(amount) * 100), // amount in paise
      currency: 'INR',
      receipt: bookingId || `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    logger.info(`[Razorpay] Order created successfully: ${order.id}`);

    res.status(200).json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt
    });
  } catch (error) {
    logger.error('[Razorpay] Order creation failed:', error);
    const errMsg = 
      (error.error && error.error.description) || 
      error.description || 
      error.message || 
      (typeof error === 'object' ? JSON.stringify(error) : String(error));
    res.status(500).json({ error: errMsg || 'Failed to create Razorpay order' });
  }
});

export default router;
