import express from 'express';
import { getSubscriptions, getSubscriptionWithTasks, swapPartnerForTasks, assignPartnerToTasks } from '../services/subscriptionService.js';
import logger from '../config/logger.js';

const router = express.Router();

// Get all subscriptions
router.get('/', async (req, res) => {
  try {
    const subscriptions = await getSubscriptions();
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific subscription with its tasks
router.get('/:id', async (req, res) => {
  try {
    const data = await getSubscriptionWithTasks(req.params.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Swap partner for a subscription (Admin Action)
router.post('/:id/swap-partner', async (req, res) => {
  try {
    const { customerId, badPartnerId, swapType } = req.body;
    
    if (!badPartnerId) {
      return res.status(400).json({ error: 'badPartnerId is required' });
    }

    const result = await swapPartnerForTasks(req.params.id, customerId, badPartnerId, swapType);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign partner to subscription tasks (Admin Action)
router.post('/:id/assign', async (req, res) => {
  try {
    const { partnerId, taskId } = req.body;
    
    if (!partnerId) {
      return res.status(400).json({ error: 'partnerId is required' });
    }

    const result = await assignPartnerToTasks(req.params.id, partnerId, taskId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
