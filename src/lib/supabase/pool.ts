// Supabase connection pooling for better performance
import { createClient } from '@supabase/supabase-js';

interface PooledClient {
  client: ReturnType<typeof createClient>;
  inUse: boolean;
  lastUsed: number;
}

class SupabasePool {
  private pool: PooledClient[] = [];
  private maxSize: number;
  private minSize: number;
  private idleTimeout: number;

  constructor(
    maxSize: number = 10,
    minSize: number = 2,
    idleTimeout: number = 300000 // 5 minutes
  ) {
    this.maxSize = maxSize;
    this.minSize = minSize;
    this.idleTimeout = idleTimeout;
    
    // Initialize minimum connections
    this.initializePool();
    
    // Cleanup idle connections periodically
    this.startCleanup();
  }

  private initializePool() {
    for (let i = 0; i < this.minSize; i++) {
      this.pool.push(this.createConnection());
    }
  }

  private createConnection(): PooledClient {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    return {
      client: createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-connection-pooled': 'true'
          }
        }
      }),
      inUse: false,
      lastUsed: Date.now()
    };
  }

  async acquire(): Promise<ReturnType<typeof createClient>> {
    // Find available connection
    let connection = this.pool.find(conn => !conn.inUse);

    // Create new connection if pool not full
    if (!connection && this.pool.length < this.maxSize) {
      connection = this.createConnection();
      this.pool.push(connection);
    }

    // Wait for available connection if pool is full
    if (!connection) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.acquire(); // Retry
    }

    connection.inUse = true;
    connection.lastUsed = Date.now();
    return connection.client;
  }

  release(client: ReturnType<typeof createClient>) {
    const connection = this.pool.find(conn => conn.client === client);
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = Date.now();
    }
  }

  private startCleanup() {
    setInterval(() => {
      const now = Date.now();
      const minConnections = this.minSize;

      // Remove idle connections above minimum size
      this.pool = this.pool.filter((conn, index) => {
        if (index < minConnections) return true; // Keep minimum connections
        if (conn.inUse) return true; // Keep in-use connections
        
        const isIdle = now - conn.lastUsed > this.idleTimeout;
        if (isIdle) {
          console.log('[Pool] Removing idle connection');
        }
        return !isIdle;
      });
    }, 60000); // Check every minute
  }

  getStats() {
    return {
      total: this.pool.length,
      inUse: this.pool.filter(c => c.inUse).length,
      idle: this.pool.filter(c => !c.inUse).length,
      maxSize: this.maxSize
    };
  }
}

// Singleton instance
let poolInstance: SupabasePool | null = null;

export function getSupabasePool(): SupabasePool {
  if (!poolInstance) {
    poolInstance = new SupabasePool(
      parseInt(process.env.SUPABASE_POOL_MAX || '10'),
      parseInt(process.env.SUPABASE_POOL_MIN || '2')
    );
  }
  return poolInstance;
}

// Helper function to use pooled client
export async function withPooledClient<T>(
  callback: (client: ReturnType<typeof createClient>) => Promise<T>
): Promise<T> {
  const pool = getSupabasePool();
  const client = await pool.acquire();
  
  try {
    return await callback(client);
  } finally {
    pool.release(client);
  }
}

