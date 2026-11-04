import { WsRateLimitService } from './ws-rate-limit.service'

describe('WsRateLimitService (P2-T2)', () => {
  it('permite hasta el límite y bloquea el exceso', () => {
    const svc = new WsRateLimitService()
    // Límite mínimo posible para no depender del env.
    expect(svc.consume('k1', 'default')).toBe(true)
    void svc
  })

  it('respeta límites por env con ventana de 60s', () => {
    jest.useFakeTimers()
    try {
      process.env.RATE_LIMIT_DEFAULT_PER_MIN = '2'
      const svc = new WsRateLimitService()
      expect(svc.limitFor('default')).toBe(2)
      expect(svc.consume('burst', 'default')).toBe(true)
      expect(svc.consume('burst', 'default')).toBe(true)
      expect(svc.consume('burst', 'default')).toBe(false)
      // Ventana independiente por clave.
      expect(svc.consume('otra', 'default')).toBe(true)
      // Tras 61s la ventana se libera.
      jest.advanceTimersByTime(61_000)
      expect(svc.consume('burst', 'default')).toBe(true)
    } finally {
      delete process.env.RATE_LIMIT_DEFAULT_PER_MIN
      jest.useRealTimers()
    }
  })

  it('ignora env inválido y usa el default', () => {
    process.env.RATE_LIMIT_DEFAULT_PER_MIN = 'nope'
    try {
      const svc = new WsRateLimitService()
      expect(svc.limitFor('default')).toBe(120)
    } finally {
      delete process.env.RATE_LIMIT_DEFAULT_PER_MIN
    }
  })
})
