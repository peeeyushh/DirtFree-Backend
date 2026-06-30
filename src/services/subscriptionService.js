import { db } from '../config/firebase.js';
import logger from '../config/logger.js';
import admin from 'firebase-admin';

export const getSubscriptions = async () => {
  try {
    const snapshot = await db.collection('subscriptions').get();
    const subs = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      let city = 'Unknown';
      if (data.bookingId) {
        const bDoc = await db.collection('bookings').doc(data.bookingId).get();
        if (bDoc.exists) {
          city = bDoc.data().serviceCity || bDoc.data().city || 'Unknown';
        }
      }
      subs.push({ id: doc.id, ...data, city });
    }
    return subs;
  } catch (error) {
    logger.error('Error fetching subscriptions:', error);
    throw error;
  }
};

export const getSubscriptionWithTasks = async (subscriptionId) => {
  try {
    const subDoc = await db.collection('subscriptions').doc(subscriptionId).get();
    if (!subDoc.exists) throw new Error('Subscription not found');

    const subData = subDoc.data();

    const tasksSnapshot = await db.collection('serviceTasks')
      .where('subscriptionId', '==', subscriptionId)
      .get();
    
    const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    tasks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return { ...subData, id: subscriptionId, tasks };
  } catch (error) {
    logger.error(`Error fetching subscription tasks for ${subscriptionId}:`, error);
    throw error;
  }
};

export const swapPartnerForTasks = async (subscriptionId, customerId, badPartnerId, swapType) => {
  try {
    const batch = db.batch();
    
    // Optional: Add to Do Not Match list
    if (customerId && badPartnerId) {
      const customerRef = db.collection('customers').doc(customerId);
      // We assume document exists. Using set with merge to be safe, but typically update is used.
      batch.set(customerRef, { doNotMatch: admin.firestore.FieldValue.arrayUnion(badPartnerId) }, { merge: true });
    }

    const tasksSnapshot = await db.collection('serviceTasks')
      .where('subscriptionId', '==', subscriptionId)
      .where('assignedPartnerId', '==', badPartnerId)
      .get();
    
    let updatedTasks = 0;
    
    tasksSnapshot.forEach(doc => {
      // In a real app we'd filter by date > now if we only want to swap remaining tasks
      batch.update(doc.ref, { assignedPartnerId: null, status: 'pending_reassignment' });
      updatedTasks++;
    });

    // Also update parent booking to remove the worker
    const subDoc = await db.collection('subscriptions').doc(subscriptionId).get();
    if (subDoc.exists && subDoc.data().bookingId) {
      batch.update(db.collection('bookings').doc(subDoc.data().bookingId), {
        workerId: null,
        workerName: null,
        status: 'searching' // Put it back to searching
      });
    }

    await batch.commit();
    logger.info(`Detached partner ${badPartnerId} from ${updatedTasks} tasks of sub ${subscriptionId}`);

    return { success: true, message: `Reassigned ${updatedTasks} tasks. System will match a new partner shortly.` };
  } catch (error) {
    logger.error('Error swapping partner:', error);
    throw error;
  }
};

export const assignPartnerToTasks = async (subscriptionId, partnerId, taskId = null) => {
  try {
    const batch = db.batch();
    
    // Fetch partner details
    const partnerDoc = await db.collection('partners').doc(partnerId).get();
    const partnerData = partnerDoc.exists ? partnerDoc.data() : { name: 'Assigned Partner' };
    
    // Fetch subscription to get bookingId
    const subDoc = await db.collection('subscriptions').doc(subscriptionId).get();
    const bookingId = subDoc.exists ? subDoc.data().bookingId : null;

    let query = db.collection('serviceTasks')
      .where('subscriptionId', '==', subscriptionId);
      
    if (taskId) {
      // Assign to a specific task
      const taskDoc = await db.collection('serviceTasks').doc(taskId).get();
      if (taskDoc.exists) {
        batch.update(taskDoc.ref, { assignedPartnerId: partnerId, status: 'assigned' });
        
        // Also update the main booking doc so the app stops searching
        if (bookingId) {
          batch.update(db.collection('bookings').doc(bookingId), {
            status: 'assigned',
            workerId: partnerId,
            workerName: partnerData.name || `${partnerData.firstName || ''} ${partnerData.lastName || ''}`.trim() || 'Partner'
          });
        }
        
        await batch.commit();
        logger.info(`Assigned partner ${partnerId} to task ${taskId}`);
        return { success: true, message: `Partner assigned to specific task.` };
      } else {
        throw new Error('Task not found');
      }
    } else {
      // Assign to all unassigned tasks in this subscription
      const tasksSnapshot = await query.where('assignedPartnerId', '==', null).get();
      
      let updatedTasks = 0;
      tasksSnapshot.forEach(doc => {
        batch.update(doc.ref, { assignedPartnerId: partnerId, status: 'assigned' });
        updatedTasks++;
      });

      if (updatedTasks > 0) {
        if (bookingId) {
          batch.update(db.collection('bookings').doc(bookingId), {
            status: 'assigned',
            workerId: partnerId,
            workerName: partnerData.name || `${partnerData.firstName || ''} ${partnerData.lastName || ''}`.trim() || 'Partner'
          });
        }
        await batch.commit();
        logger.info(`Assigned partner ${partnerId} to ${updatedTasks} tasks of sub ${subscriptionId}`);
        return { success: true, message: `Partner assigned to ${updatedTasks} tasks.` };
      } else {
        return { success: true, message: `No pending tasks found to assign.` };
      }
    }
  } catch (error) {
    logger.error('Error assigning partner:', error);
    throw error;
  }
};

