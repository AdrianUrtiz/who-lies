import { Injectable } from '@nestjs/common'

interface Window {
  stamps: number[]
}

function limitFromEnv(name: string, fallback: number): number {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback
}

/**
 * P2-T2: rate limiting para WS (ventana deslizante, por clave).
 * - Claves pre-asiento: IP (`ip:<addr>`); con asiento: `player:<id>`.
 * - Límites por env con defaults holgados (el e2e los baja por test).
 * - Respuesta en forma ACK {success:false, code:'RATE_LIMITED'}.
 * - Single-node (en memoria); con sticky sessions o un edge limiter
 *   por delante cubre multi-instancia. Ver plan P2.
 */
@Injectable()
export class WsRateLimitService {
  private windows = new Map<string, Window>()

  /** Lee el límite en cada llamada para permitir override por env en tests. */
  limitFor(action: 'create' | 'join' | 'vote' | 'default'): number {
    switch (action) {
      case 'create':
        return limitFromEnv('RATE_LIMIT_CREATE_PER_MIN', 60)
      case 'join':
        return limitFromEnv('RATE_LIMIT_JOIN_PER_MIN', 120)
      case 'vote':
        return limitFromEnv('RATE_LIMIT_VOTE_PER_MIN', 120)
      default:
        return limitFromEnv('RATE_LIMIT_DEFAULT_PER_MIN', 120)
    }
  }

  consume(
    key: string,
    action: 'create' | 'join' | 'vote' | 'default' = 'default',
  ): boolean {
    const limit = this.limitFor(action)
    const now = Date.now()
    const cutoff = now - 60_000
    let w = this.windows.get(key)
    if (!w) {
      w = { stamps: [] }
      this.windows.set(key, w)
    }
    while (w.stamps.length > 0 && w.stamps[0] <= cutoff) w.stamps.shift()
    if (w.stamps.length >= limit) return false
    w.stamps.push(now)
    // Poda oportunista de ventanas vacías.
    if (this.windows.size > 10000) {
      for (const [k, v] of this.windows) {
        if (v.stamps.length === 0 || v.stamps[v.stamps.length - 1] <= cutoff) {
          this.windows.delete(k)
        }
      }
    }
    return true
  }

  /** Solo tests. */
  reset(): void {
    this.windows.clear()
  }
}
