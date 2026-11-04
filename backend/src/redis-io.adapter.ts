import { IoAdapter } from '@nestjs/platform-socket.io'
import { INestApplication } from '@nestjs/common'
import { createAdapter } from '@socket.io/redis-adapter'
import type { RedisService } from './common/redis/redis.service'

/**
 * P2-T1: adapta Socket.IO a Redis cuando hay REDIS_URL.
 * Sin Redis usa el adaptador en memoria (una sola réplica).
 */
export class RedisIoAdapter extends IoAdapter {
  constructor(
    app: INestApplication,
    private readonly redis: RedisService | null,
  ) {
    super(app)
  }

  createIOServer(port: number, options?: Record<string, unknown>): unknown {
    const server = super.createIOServer(port, options) as {
      adapter: (a: unknown) => void
    }
    try {
      const clients = this.redis?.adapterClients() ?? null
      if (clients) {
        server.adapter(createAdapter(clients.pub, clients.sub))
      }
    } catch {
      // Sin adaptador: modo single-node.
    }
    return server
  }
}
