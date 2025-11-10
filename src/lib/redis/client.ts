// Redis client for caching (optional - falls back gracefully if not configured)

interface RedisClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ex?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  exists: (key: string) => Promise<boolean>;
}

class MemoryCache implements RedisClient {
  private cache = new Map<string, { value: string; expires: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: string, ex: number = 300): Promise<void> {
    this.cache.set(key, {
      value,
      expires: Date.now() + (ex * 1000)
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  // Cleanup expired entries periodically
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, item] of this.cache.entries()) {
        if (now > item.expires) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Every minute
  }
}

// Create Redis client or fallback to memory cache
async function createRedisClient(): Promise<RedisClient> {
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      // Try to use ioredis if available
      // Note: Install with: npm install ioredis
       
      const { default: Redis } = await import('ioredis');
      const redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.warn('[Redis] Max retries reached, falling back to memory cache');
            return null;
          }
          return Math.min(times * 100, 2000);
        }
      });

      redis.on('error', (err: Error) => {
        console.error('[Redis] Connection error:', err.message);
      });

      redis.on('connect', () => {
        console.log('[Redis] Connected successfully');
      });

      return redis;
    } catch {
      console.warn('[Redis] ioredis not installed, using memory cache. Install with: npm install ioredis');
    }
  }

  // Fallback to memory cache
  console.log('[Cache] Using in-memory cache (install ioredis + set REDIS_URL for Redis)');
  const memCache = new MemoryCache();
  memCache.startCleanup();
  return memCache;
}

// Singleton instance
let redisClientPromise: Promise<RedisClient> | null = null;

export function getRedisClient(): Promise<RedisClient> {
  if (!redisClientPromise) {
    redisClientPromise = createRedisClient();
  }
  return redisClientPromise;
}

// Cache helper functions
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedisClient();
    const cached = await client.get(key);
    if (!cached) return null;
    
    return JSON.parse(cached) as T;
  } catch (error) {
    console.error('[Cache] Error getting cached data:', error);
    return null;
  }
}

export async function setCached<T>(key: string, value: T, ttl: number = 300): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.set(key, JSON.stringify(value), ttl);
  } catch (error) {
    console.error('[Cache] Error setting cached data:', error);
  }
}

export async function deleteCached(key: string): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.del(key);
  } catch (error) {
    console.error('[Cache] Error deleting cached data:', error);
  }
}

export async function invalidateConversationCache(pageId: string): Promise<void> {
  const patterns = [
    `conversations:${pageId}`,
    `conversations:all`,
    `conversation:*:${pageId}`
  ];
  
  for (const pattern of patterns) {
    await deleteCached(pattern);
  }
}

