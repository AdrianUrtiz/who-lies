import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import Redis from 'ioredis'

/**
 * P2-T1: Redis opcional para multi-instancia.
 * - Sin REDIS_URL: todo es no-op (una sola réplica, comportamiento P1).
 * - Con REDIS_URL: pub/sub para fan-out + locks anti-doble-ejecución.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name)
  private pub: Redis | null = null
  private sub: Redis | null = null
  private handlers = new Map<string, Set<(payload: unknown) => void>>()
  private subChannels = new Set<string>()
  private ready = false

  get enabled(): boolean {
    return !!process.env.REDIS_URL
  }

  get isReady(): boolean {
    return this.ready && !!this.pub && !!this.sub
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) return
    try {
      const url = process.env.REDIS_URL as string
      this.pub = new Redis(url, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: false,
      })
      this.sub = this.pub.duplicate()
      this.sub.on('message', (channel: string, message: string) => {
        const set = this.handlers.get(channel)
        if (!set) return
        let payload: unknown = message
        try {
          payload = JSON.parse(message)
        } catch {
          // texto plano
        }
        for (const fn of set) {
          try {
            fn(payload)
          } catch (e) {
            this.logger.warn(`handler error en ${channel}: ${String(e)}`)
          }
        }
      })
      await this.pub.ping()
      this.ready = true
      for (const ch of this.subChannels) {
        await this.sub.subscribe(ch).catch(() => undefined)
      }
      this.logger.log('Redis conectado')
    } catch (e) {
      this.logger.warn(`Redis no disponible, modo single-node: ${String(e)}`)
      await this.disconnect().catch(() => undefined)
      this.pub = null
      this.sub = null
      this.ready = false
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect().catch(() => undefined)
  }

  private async disconnect(): Promise<void> {
    const p = this.pub
    const s = this.sub
    this.pub = null
    this.sub = null
    this.ready = false
    try {
      p?.disconnect()
    } catch {
      // noop
    }
    try {
      s?.disconnect()
    } catch {
      // noop
    }
  }

  /** Clientes para el adaptador Socket.IO (null si no hay Redis). */
  adapterClients(): { pub: Redis; sub: Redis } | null {
    if (!this.isReady || !this.pub || !this.sub) return null
    return { pub: this.pub, sub: this.sub }
  }

  async publish(channel: string, payload: unknown): Promise<void> {
    if (!this.isReady || !this.pub) return
    try {
      const msg =
        typeof payload === 'string' ? payload : JSON.stringify(payload)
      await this.pub.publish(channel, msg)
    } catch {
      // pub/sub es best-effort; el path local ya entregó.
    }
  }

  async subscribe(
    channel: string,
    fn: (payload: unknown) => void,
  ): Promise<void> {
    let set = this.handlers.get(channel)
    if (!set) {
      set = new Set()
      this.handlers.set(channel, set)
    }
    set.add(fn)
    if (this.isReady && this.sub && !this.subChannels.has(channel)) {
      this.subChannels.add(channel)
      await this.sub.subscribe(channel).catch(() => undefined)
    }
  }

  /**
   * Lock anti-doble-ejecución entre réplicas (gracia de desconexión).
   * Sin Redis devuelve true (una sola réplica).
   */
  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    if (!this.isReady || !this.pub) return true
    try {
      const res = await this.pub.set(key, '1', 'PX', ttlMs, 'NX')
      return res === 'OK'
    } catch {
      return true
    }
  }
}
