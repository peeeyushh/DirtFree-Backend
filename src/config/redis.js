import Redis from 'ioredis';
import logger from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

// Create a Redis client instance
// In production, REDIS_URL should point to your managed Redis instance (e.g., AWS ElastiCache, Upstash, Redis Labs)
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

redis.on('connect', () => {
  logger.info('🟢 Connected to Redis successfully');
});

redis.on('error', (err) => {
  logger.error('❌ Redis connection error:', err.message);
});

export default redis;
