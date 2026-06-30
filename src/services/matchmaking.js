import redis from '../config/redis.js';
import logger from '../config/logger.js';

/**
 * Finds the nearest active partners to a given location using Redis GEORADIUS.
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {number} radiusInKm - Search radius in kilometers
 * @param {number} maxResults - Maximum number of partners to return
 * @returns {Promise<Array<{partnerId: string, distance: number}>>}
 */
export const findNearestPartners = async (latitude, longitude, radiusInKm = 5, maxResults = 10) => {
  try {
    // GEORADIUS key longitude latitude radius m|km|ft|mi [WITHCOORD] [WITHDIST] [WITHHASH] [COUNT count] [ASC|DESC]
    const results = await redis.georadius(
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
