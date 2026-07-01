import redis from '../config/redis.js';
import logger from '../config/logger.js';
import { db } from '../config/firebase.js';

// Haversine formula — distance between two GPS points in km
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the nearest active partners to a given location using Redis GEORADIUS.
 * Falls back to Firestore if Redis is unavailable.
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {number} radiusInKm - Search radius in kilometers
 * @param {number} maxResults - Maximum number of partners to return
 * @returns {Promise<Array<{partnerId: string, distance: number}>>}
 */
export const findNearestPartners = async (latitude, longitude, radiusInKm = 5, maxResults = 10) => {
  try {
    let results = [];
    
    try {
      // Try to query Redis first
      results = await redis.georadius(
        'partners_location',
        longitude,
        latitude,
        radiusInKm,
        'km',
        'WITHDIST',
        'WITHCOORD',
        'ASC',
        'COUNT',
        maxResults
      );
    } catch (redisError) {
      logger.warn(`⚠️ Redis georadius failed, falling back to Firestore: ${redisError.message}`);
      
      // Fallback: Query all online partners from Firestore and filter locally
      if (db) {
        const snapshot = await db.collection('partners')
          .where('isOnline', '==', true)
          .get();
        
        const onlinePartners = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          const pLat = data.latitude || data.location?.lat;
          const pLng = data.longitude || data.location?.lng;
          if (pLat && pLng) {
            const distance = getDistanceKm(latitude, longitude, pLat, pLng);
            if (distance <= radiusInKm) {
              onlinePartners.push({
                partnerId: doc.id,
                distance,
                coords: [pLng, pLat]
              });
            }
          }
        });
        
        // Sort by distance ASC and take maxResults
        onlinePartners.sort((a, b) => a.distance - b.distance);
        const limitedPartners = onlinePartners.slice(0, maxResults);
        
        // Format to match redis.georadius result structure: [partnerId, distanceStr, [lon, lat]]
        results = limitedPartners.map(p => [
          p.partnerId,
          p.distance.toFixed(3),
          p.coords
        ]);
      } else {
        throw new Error('Firestore database is not initialized, cannot perform matchmaking fallback');
      }
    }

    // Fetch real driving distance from OSRM for each partner
    const partners = await Promise.all(results.map(async (result) => {
      const partnerId = result[0];
      const straightLineDist = parseFloat(result[1]);
      const [partnerLon, partnerLat] = result[2];

      let distance = straightLineDist;
      let etaMinutes = null;

      try {
        // Use 'bike' profile for shortest urban routes instead of 'driving' which takes long highway detours
        const osrmUrl = `http://router.project-osrm.org/route/v1/bike/${partnerLon},${partnerLat};${longitude},${latitude}?overview=false`;
        const response = await fetch(osrmUrl);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          distance = data.routes[0].distance / 1000;
          // Calculate realistic city ETA based on 25 km/h average speed, since 'bike' duration would be too slow
          etaMinutes = Math.ceil((distance / 25) * 60);
        }
      } catch (err) {
        logger.warn(`⚠️ OSRM API failed for partner ${partnerId}, falling back to straight-line distance.`);
      }

      return {
        partnerId,
        distance,
        eta: etaMinutes // e.g. 5 (minutes)
      };
    }));

    // Re-sort by actual driving distance just in case
    partners.sort((a, b) => a.distance - b.distance);

    return partners;
  } catch (error) {
    logger.error(`❌ Matchmaking Error (findNearestPartners): ${error.message}`);
    throw error;
  }
};
