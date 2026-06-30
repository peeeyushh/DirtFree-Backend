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
    // ioredis returns an array of arrays when using WITHDIST. e.g. [["partner1", "1.2"], ["partner2", "3.4"]]
    const results = await redis.georadius(
      'partners_location',
      longitude,
      latitude,
      radiusInKm,
      'km',
      'WITHDIST',
      'ASC',
      'COUNT',
      maxResults
    );

    // Format the results into a more usable object
    const partners = results.map(result => ({
      partnerId: result[0],
      distance: parseFloat(result[1])
    }));

    return partners;
  } catch (error) {
    logger.error(`❌ Matchmaking Error (findNearestPartners): ${error.message}`);
    throw error;
  }
};
