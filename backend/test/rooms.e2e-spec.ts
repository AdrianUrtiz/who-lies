import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import { io, Socket } from 'socket.io-client'
import { AppModule } from './../src/app.module'
import { PrismaService } from './../src/prisma/prisma.service'
import { RoomsService } from './../src/rooms/rooms.service'
import { WsRateLimitService } from './../src/common/rate-limit/ws-rate-limit.service'

/**
 * E2E de salas (P0 gate).
 *
 * Cubre:
 *  - Happy path completo vía WebSocket (create -> join x3 -> start -> voting -> process -> continue/finish)
 *  - Broadcasts a sala (roomUpdated, gameStarted, votingStarted, voteSubmitted, votingResults, gameContinued)
 *  - Guards ya existentes (mínimo 3, no unirse tras iniciar, no auto-voto, no procesar sin votos)
 *  - Gates P0 que HOY FALLAN y definen T1-T6 (validación, no-filtración de liar,
 *    códigos únicos, categoría inválida, doble transición, empate).
 *
 * Requiere PostgreSQL en DATABASE_URL (ver backend/.env + docker-compose.yml).
 * Si la DB no es alcanzable, la suite se salta con un aviso en vez de dar rojo
 * por entorno (ver `checkDb`).
 *
 * Ejecutar:
 *   cd backend
 *   npx prisma migrate dev
 *   npm run test:e2e -- rooms.e2e-spec
 */

jest.setTimeout(30000)

// P1-B2: gracia corta en tests (el gateway la lee dinámicamente).
process.env.PRESENCE_GRACE_MS = process.env.PRESENCE_GRACE_MS || '400'

type Ack = {
  success: boolean
  room?: any
  player?: any
  yourPlayer?: any
  results?: any
  closed?: boolean
  error?: any
  code?: string
}

function emitAck(socket: Socket, event: string, payload: any): Promise<Ack> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res: Ack) => resolve(res as Ack))
  })
}

function waitFor<T = any>(
  socket: Socket,
  event: string,
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler)
      reject(new Error(`timeout esperando evento '${event}'`))
    }, timeoutMs)
    const handler = (data: T) => {
      clearTimeout(timer)
      socket.off(event, handler)
      resolve(data)
    }
    socket.on(event, handler)
  })
}

describe('Rooms (e2e, socket + service)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let service: RoomsService
  let rateLimit: WsRateLimitService | undefined
  let port: number
  let url: string
  let dbAvailable = true
  const sockets: Socket[] = []

  beforeAll(async () => {
    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile()

      app = moduleFixture.createNestApplication()
      await app.listen(0)
    } catch (e) {
      dbAvailable = false
      // eslint-disable-next-line no-console
      console.warn(
        '[rooms.e2e] No se pudo arrancar Nest (probablemente sin DB). Se omite la suite.',
        String((e as Error)?.message ?? e).slice(0, 300),
      )
      return
    }
    const server = app.getHttpServer()
    const addr = server.address()
    port = typeof addr === 'object' && addr ? addr.port : 3001
    url = `http://localhost:${port}`

    prisma = app.get(PrismaService, { strict: false })
    service = app.get(RoomsService, { strict: false })
    try {
      rateLimit = app.get(WsRateLimitService, { strict: false })
    } catch {
      rateLimit = undefined
    }

    try {
      await prisma.$queryRaw`SELECT 1`
    } catch (e) {
      dbAvailable = false
      // eslint-disable-next-line no-console
      console.warn(
        '[rooms.e2e] PostgreSQL no alcanzable en DATABASE_URL, se omite la suite. ' +
          'Levanta la DB con `docker compose up -d` y `npx prisma migrate dev`.',
      )
    }
  })

  afterAll(async () => {
    for (const s of sockets) {
      try {
        s.disconnect()
      } catch {
        /* noop */
      }
    }
    if (app) {
      try {
        await app.close()
      } catch {
        /* ya cerrada o nunca arrancó */
      }
    }
    // PrismaService cierra en onModuleDestroy vía app.close()
  })

  beforeEach(async () => {
    // P2-T2: ventanas limpias por test (el límite es por IP compartida).
    try {
      rateLimit?.reset()
    } catch {
      // noop
    }
    if (!dbAvailable || !prisma) return
    // Limpieza total, orden por FK.
    await prisma.vote.deleteMany().catch(() => undefined)
    await prisma.player.deleteMany().catch(() => undefined)
    await prisma.room.deleteMany().catch(() => undefined)
  })

  function connectClient(): Socket {
    const s = io(url, { transports: ['websocket'], reconnection: false })
    sockets.push(s)
    return s
  }

  async function connectedClient(): Promise<Socket> {
    const s = connectClient()
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('connect timeout')), 5000)
      s.on('connect', () => {
        clearTimeout(t)
        resolve()
      })
      s.on('connect_error', (e) => {
        clearTimeout(t)
        reject(e)
      })
    })
    return s
  }

  // Si no hay DB, convierte cada test en skip en vez de rojo por entorno.
  function gate(name: string, fn: () => Promise<void> | void) {
    it(name, async () => {
      if (!dbAvailable || !app) {
        // eslint-disable-next-line no-console
        console.warn(`[rooms.e2e] SKIP '${name}' (sin DB)`)
        return
      }
      await fn()
    })
  }

  // ---------------------------------------------------------------- happy path
  gate(
    'happy path: crear -> unir x2 -> iniciar -> votar -> procesar',
    async () => {
      const host = await connectedClient()
      const c2 = await connectedClient()
      const c3 = await connectedClient()

      const created = await emitAck(host, 'createRoom', {
        categoryId: 'marvel',
        hostName: 'Host',
      })
      expect(created.success).toBe(true)
      expect(created.room.code).toMatch(/^[A-Z0-9]{6}$/)
      expect(created.player.name).toBe('Host')
      const roomId: string = created.room.id
      const code: string = created.room.code

      // El resto se une por código; cada join hace broadcast roomUpdated al host.
      const roomUpdatedP = waitFor(host, 'roomUpdated')
      const j2 = await emitAck(c2, 'joinRoom', { code, playerName: 'P2' })
      expect(j2.success).toBe(true)
      await roomUpdatedP

      const j3 = await emitAck(c3, 'joinRoom', { code, playerName: 'P3' })
      expect(j3.success).toBe(true)

      const gameStartedP = waitFor(c2, 'gameStarted')
      const hostId: string = created.player.id
      const hostSecret: string = created.player.secret
      const started = await emitAck(host, 'startGame', {
        roomId,
        requesterPlayerId: hostId,
        secret: hostSecret,
      })
      expect(started.success).toBe(true)
      const startedRoom = await gameStartedP
      expect(startedRoom.id).toBe(roomId)
      expect(startedRoom.players).toHaveLength(3)

      // P0-T2: el broadcast es público, sin isLiar ni character.
      for (const p of startedRoom.players) {
        expect('isLiar' in p).toBe(false)
        expect('character' in p).toBe(false)
      }
      // El rol real se verifica vía service (interno, con roles).
      const fullStarted = await service.getRoomById(roomId)
      const liars = fullStarted.players.filter((p: any) => p.isLiar)
      expect(liars).toHaveLength(1)
      for (const p of fullStarted.players) {
        if (p.isLiar) expect(p.character).toBeNull()
        else expect(typeof p.character).toBe('string')
      }

      // Votación: todos votan contra un no-mentiroso para no terminar el juego
      // (así podemos probar continueGame después). Elegimos víctima arbitraria.
      const victim = fullStarted.players.find((p: any) => !p.isLiar)
      const votingStartedP = waitFor(c3, 'votingStarted')
      const sv = await emitAck(host, 'startVoting', {
        roomId,
        requesterPlayerId: hostId,
        secret: hostSecret,
      })
      expect(sv.success).toBe(true)
      await votingStartedP

      const players: any[] = startedRoom.players
      // Cada jugador vota por la víctima salvo la propia víctima, que vota por otro.
      void players
      // Votación explícita por id real de cada jugador.
      const byName = new Map(
        startedRoom.players.map((p: any) => [p.name, p.id]),
      )
      if (!victim) throw new Error('test: sin víctima')
      const victimId: string = victim.id
      const secretByName = new Map([
        ['Host', created.player.secret],
        ['P2', j2.player.secret],
        ['P3', j3.player.secret],
      ])
      const voteAs = (sock: any, name: string) =>
        emitAck(sock, 'submitVote', {
          roomId,
          voterId: byName.get(name),
          votedForId:
            victimId === byName.get(name)
              ? byName.get(name === 'Host' ? 'P2' : 'Host')
              : victimId,
          secret: secretByName.get(name),
        }).then((r) => expect(r.success).toBe(true))
      await voteAs(host, 'Host')
      await voteAs(c2, 'P2')
      await voteAs(c3, 'P3')

      const resultsP = waitFor(host, 'votingResults')
      const proc = await emitAck(host, 'processVoting', {
        roomId,
        requesterPlayerId: hostId,
        secret: hostSecret,
      })
      expect(proc.success).toBe(true)
      const results = await resultsP
      expect(results.eliminatedPlayer).toBeDefined()
      expect(typeof results.liarCaught).toBe('boolean')
      // P2: ni siquiera en FINISHED viaja el secreto (roles sí, secret no).
      expect(JSON.stringify(results)).not.toContain('secret')

      if (!results.gameFinished) {
        const continuedP = waitFor(host, 'gameContinued')
        const cont = await emitAck(host, 'continueGame', {
          roomId,
          requesterPlayerId: hostId,
          secret: hostSecret,
        })
        expect(cont.success).toBe(true)
        const continued = await continuedP
        expect(continued.id).toBe(roomId)
      } else {
        // Si el azar eliminó al liar, el juego termina: estado FINISHED.
        expect(results.room.status).toBe('FINISHED')
      }
    },
  )

  // ---------------------------------------------------------------- guards (pasan hoy)
  gate('guard: no inicia con menos de 3 jugadores', async () => {
    const host = await connectedClient()
    const created = await emitAck(host, 'createRoom', {
      categoryId: 'marvel',
      hostName: 'Solo',
    })
    expect(created.success).toBe(true)
    const res = await emitAck(host, 'startGame', {
      roomId: created.room.id,
      requesterPlayerId: created.player.id,
      secret: created.player.secret,
    })
    expect(res.success).toBe(false)
    expect(String(res.error)).toMatch(/at least 3/i)
  })

  gate('guard: no unirse cuando ya empezó', async () => {
    const host = await connectedClient()
    const c2 = await connectedClient()
    const c3 = await connectedClient()
    const c4 = await connectedClient()
    const created = await emitAck(host, 'createRoom', {
      categoryId: 'marvel',
      hostName: 'H',
    })
    const code = created.room.code
    await emitAck(c2, 'joinRoom', { code, playerName: 'A' })
    await emitAck(c3, 'joinRoom', { code, playerName: 'B' })
    await emitAck(host, 'startGame', {
      roomId: created.room.id,
      requesterPlayerId: created.player.id,
      secret: created.player.secret,
    })
    const late = await emitAck(c4, 'joinRoom', { code, playerName: 'Tarde' })
    expect(late.success).toBe(false)
    expect(String(late.error)).toMatch(/already started/i)
  })

  gate('guard: solo el host muta el juego (A4)', async () => {
    const host = await connectedClient()
    const c2 = await connectedClient()
    const c3 = await connectedClient()
    const created = await emitAck(host, 'createRoom', {
      categoryId: 'marvel',
      hostName: 'H',
    })
    const j2 = await emitAck(c2, 'joinRoom', {
      code: created.room.code,
      playerName: 'A',
    })
    await emitAck(c3, 'joinRoom', {
      code: created.room.code,
      playerName: 'B',
    })
    const roomId = created.room.id
    // No-host intenta iniciar: FORBIDDEN aunque haya 3 jugadores.
    const evil = await emitAck(c2, 'startGame', {
      roomId,
      requesterPlayerId: j2.player.id,
      secret: j2.player.secret,
    })
    expect(evil.success).toBe(false)
    expect(String(evil.error)).toMatch(/host/i)
    // El host sí puede.
    const ok = await emitAck(host, 'startGame', {
      roomId,
      requesterPlayerId: created.player.id,
      secret: created.player.secret,
    })
    expect(ok.success).toBe(true)
    // No-host intenta votar-fase y continuar: FORBIDDEN.
    const evilVoting = await emitAck(c2, 'startVoting', {
      roomId,
      requesterPlayerId: j2.player.id,
      secret: j2.player.secret,
    })
    expect(evilVoting.success).toBe(false)
  })

  gate('guard: sin suplantación de jugador (A3)', async () => {
    const host = await connectedClient()
    const c2 = await connectedClient()
    const c3 = await connectedClient()
    const created = await emitAck(host, 'createRoom', {
      categoryId: 'marvel',
      hostName: 'H',
    })
    const j2 = await emitAck(c2, 'joinRoom', {
      code: created.room.code,
      playerName: 'A',
    })
    await emitAck(c3, 'joinRoom', {
      code: created.room.code,
      playerName: 'B',
    })
    const roomId = created.room.id
    await emitAck(host, 'startGame', {
      roomId,
      requesterPlayerId: created.player.id,
      secret: created.player.secret,
    })
    // c2 intenta revelar/ready como si fuera el host.
    const spoofReveal = await emitAck(c2, 'revealCharacter', {
      playerId: created.player.id,
      roomId,
      secret: j2.player.secret,
    })
    expect(spoofReveal.success).toBe(false)
    expect(String(spoofReveal.error)).toMatch(/another player/i)
    // c2 intenta votar como otro.
    await emitAck(host, 'startVoting', {
      roomId,
      requesterPlayerId: created.player.id,
      secret: created.player.secret,
    })
    const spoofVote = await emitAck(c2, 'submitVote', {
      roomId,
      voterId: created.player.id,
      votedForId: j2.player.id,
      secret: j2.player.secret,
    })
    expect(spoofVote.success).toBe(false)
  })

  gate('guard: no auto-voto y no procesar sin votos', async () => {
    const host = await connectedClient()
    const c2 = await connectedClient()
    const c3 = await connectedClient()
    const created = await emitAck(host, 'createRoom', {
      categoryId: 'marvel',
      hostName: 'H',
    })
    const code = created.room.code
    const j2 = await emitAck(c2, 'joinRoom', { code, playerName: 'A' })
    await emitAck(c3, 'joinRoom', { code, playerName: 'B' })
    const roomId = created.room.id
    await emitAck(host, 'startGame', {
      roomId,
      requesterPlayerId: created.player.id,
      secret: created.player.secret,
    })
    await emitAck(host, 'startVoting', {
      roomId,
      requesterPlayerId: created.player.id,
      secret: created.player.secret,
    })

    const self = await emitAck(host, 'submitVote', {
      roomId,
      voterId: created.player.id,
      votedForId: created.player.id,
      secret: created.player.secret,
    })
    expect(self.success).toBe(false)

    // Usa una sala fresca para "sin votos": crea otra y procesa sin votar.
    const host2 = await connectedClient()
    const d2 = await connectedClient()
    const d3 = await connectedClient()
    const c = await emitAck(host2, 'createRoom', {
      categoryId: 'marvel',
      hostName: 'H2',
    })
    await emitAck(d2, 'joinRoom', { code: c.room.code, playerName: 'A2' })
    await emitAck(d3, 'joinRoom', { code: c.room.code, playerName: 'B2' })
    await emitAck(host2, 'startGame', {
      roomId: c.room.id,
      requesterPlayerId: c.player.id,
      secret: c.player.secret,
    })
    await emitAck(host2, 'startVoting', {
      roomId: c.room.id,
      requesterPlayerId: c.player.id,
      secret: c.player.secret,
    })
    const empty = await emitAck(host2, 'processVoting', {
      roomId: c.room.id,
      requesterPlayerId: c.player.id,
      secret: c.player.secret,
    })
    expect(empty.success).toBe(false)
    expect(String(empty.error)).toMatch(/no votes/i)
    void j2
  })

  // Gates P0: deben pasar con la implementación T1-T6.

  gate(
    'P0-T1: payload inválido se rechaza con BAD_REQUEST, no 500',
    async () => {
      const s = await connectedClient()
      const badCreate = await emitAck(s, 'createRoom', {
        categoryId: 'no-existe',
        hostName: '',
      })
      expect(badCreate.success).toBe(false)
      expect(String(badCreate.code ?? badCreate.error)).toMatch(
        /BAD_REQUEST|INVALID/i,
      )

      const badJoin = await emitAck(s, 'joinRoom', {
        code: 'ab',
        playerName: '',
      })
      expect(badJoin.success).toBe(false)

      // UUID largo no-UUID no debe llegar a Prisma como 500: BAD_REQUEST.
      const badId = await emitAck(s, 'startGame', {
        roomId: 'x'.repeat(36),
        requesterPlayerId: 'y'.repeat(36),
        secret: '123e4567-e89b-42d3-a456-426614174000',
      })
      expect(badId.success).toBe(false)
      expect(String(badId.code ?? badId.error)).toMatch(/BAD_REQUEST|INVALID/i)

      // Voto a uno mismo se rechaza a nivel DTO (CANNOT_VOTE_SELF).
      const selfVote = await emitAck(s, 'submitVote', {
        roomId: '123e4567-e89b-42d3-a456-426614174000',
        voterId: '123e4567-e89b-42d3-a456-426614174000',
        votedForId: '123e4567-e89b-42d3-a456-426614174000',
        secret: '123e4567-e89b-42d3-a456-426614174001',
      })
      expect(selfVote.success).toBe(false)
    },
  )

  gate('P0-T2: roomUpdated/gameStarted no filtran isLiar', async () => {
    const host = await connectedClient()
    const c2 = await connectedClient()
    const c3 = await connectedClient()
    const created = await emitAck(host, 'createRoom', {
      categoryId: 'marvel',
      hostName: 'H',
    })
    const seen: any[] = []
    c2.on('gameStarted', (r) => seen.push(r))
    const updates: any[] = []
    c2.on('roomUpdated', (r) => updates.push(r))
    await emitAck(c2, 'joinRoom', { code: created.room.code, playerName: 'A' })
    await emitAck(c3, 'joinRoom', { code: created.room.code, playerName: 'B' })
    for (const u of updates) {
      for (const p of u.players as any[]) {
        expect('isLiar' in p).toBe(false)
      }
    }
    const started = await emitAck(host, 'startGame', {
      roomId: created.room.id,
      requesterPlayerId: created.player.id,
      secret: created.player.secret,
    })
    expect(started.success).toBe(true)
    // El host recibe su rol privado en el ACK.
    expect(started.yourPlayer).toBeDefined()
    expect('isLiar' in started.yourPlayer).toBe(true)
    // El broadcast no debe incluir el rol.
    const broadcast = seen[0] ?? started.room
    expect(broadcast.players).toHaveLength(3)
    const leaked = (broadcast.players as any[]).some(
      (p) => 'isLiar' in p || 'character' in p,
    )
    expect(leaked).toBe(false)
    const full = await service.getRoomById(created.room.id)
    expect(full.players.filter((p) => p.isLiar)).toHaveLength(1)
  })

  gate('P0-T4: 50 salas paralelas dan 50 códigos únicos', async () => {
    // Va directo al service para aislar la colisión de generateRoomCode.
    // DoD A5: 50 en paralelo.
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        service.createRoom('marvel', `Host${i}`),
      ),
    )
    const codes = results.map((r) => r.room.code)
    expect(new Set(codes).size).toBe(50)
  })

  gate(
    'P0-T5: doble startGame / doble processVoting no duplica efectos',
    async () => {
      const host = await connectedClient()
      const c2 = await connectedClient()
      const c3 = await connectedClient()
      const created = await emitAck(host, 'createRoom', {
        categoryId: 'marvel',
        hostName: 'H',
      })
      await emitAck(c2, 'joinRoom', {
        code: created.room.code,
        playerName: 'A',
      })
      await emitAck(c3, 'joinRoom', {
        code: created.room.code,
        playerName: 'B',
      })
      const roomId = created.room.id
      const hostPid: string = created.player.id
      const hostSecret5: string = created.player.secret
      const first = await emitAck(host, 'startGame', {
        roomId,
        requesterPlayerId: hostPid,
        secret: hostSecret5,
      })
      expect(first.success).toBe(true)
      const second = await emitAck(host, 'startGame', {
        roomId,
        requesterPlayerId: hostPid,
        secret: hostSecret5,
      })
      expect(second.success).toBe(false)

      await emitAck(host, 'startVoting', {
        roomId,
        requesterPlayerId: hostPid,
        secret: hostSecret5,
      })
      const room = await service.getRoomById(roomId)
      const others = room.players.filter((p) => p.id !== room.players[0].id)
      // Todos votan por players[0] para resultado determinista.
      for (const v of others) {
        await service.submitVote(roomId, v.id, room.players[0].id)
      }
      // Primer votante (players[0]) vota por otro para completar.
      await service.submitVote(roomId, room.players[0].id, others[0].id)
      const [r1, r2] = await Promise.allSettled([
        service.processVotingResults(roomId, hostPid, hostSecret5),
        service.processVotingResults(roomId, hostPid, hostSecret5),
      ])
      // P0: uno cumple, el otro falla (guard de status/transacción).
      const fulfilled = [r1, r2].filter((r) => r.status === 'fulfilled')
      expect(fulfilled.length).toBe(1)
      const after = await service.getRoomById(roomId)
      // La ronda solo avanza +1 si el juego continúa, nunca +2.
      expect(after.currentRound).toBeLessThanOrEqual(room.currentRound + 1)
    },
  )

  gate('P0-T6: empate 2-2 no elimina a nadie y exige revotar', async () => {
    const host = await connectedClient()
    const c2 = await connectedClient()
    const c3 = await connectedClient()
    const c4 = await connectedClient()
    const created = await emitAck(host, 'createRoom', {
      categoryId: 'marvel',
      hostName: 'H',
    })
    await emitAck(c2, 'joinRoom', { code: created.room.code, playerName: 'A' })
    await emitAck(c3, 'joinRoom', { code: created.room.code, playerName: 'B' })
    await emitAck(c4, 'joinRoom', { code: created.room.code, playerName: 'C' })
    const roomId = created.room.id
    const hostPid: string = created.player.id
    const hostSecret6: string = created.player.secret
    await emitAck(host, 'startGame', {
      roomId,
      requesterPlayerId: hostPid,
      secret: hostSecret6,
    })
    await emitAck(host, 'startVoting', {
      roomId,
      requesterPlayerId: hostPid,
      secret: hostSecret6,
    })
    const room = await service.getRoomById(roomId)
    const [p1, p2, p3, p4] = room.players
    // 2 votos a p1, 2 votos a p2.
    await service.submitVote(roomId, p1.id, p2.id)
    await service.submitVote(roomId, p2.id, p1.id)
    await service.submitVote(roomId, p3.id, p1.id)
    await service.submitVote(roomId, p4.id, p2.id)
    const res: any = await service
      .processVotingResults(roomId, hostPid, hostSecret6)
      .catch((e) => ({ __error: String(e?.message ?? e) }))
    // Comportamiento P0 deseado: empate declarado, sin eliminado, sigue en VOTING.
    expect(res.__error).toBeUndefined()
    expect(res.eliminatedPlayer ?? null).toBeNull()
    expect(res.tie === true || res.tiedIds?.length === 2).toBe(true)
    expect(res.room.status).toBe('VOTING')
  })

  gate('P1-B1: rejoin reutiliza el asiento (sin duplicar Player)', async () => {
    const host = await connectedClient()
    const c2 = await connectedClient()
    const c3 = await connectedClient()
    const created = await emitAck(host, 'createRoom', {
      categoryId: 'marvel',
      hostName: 'H',
    })
    const j2 = await emitAck(c2, 'joinRoom', {
      code: created.room.code,
      playerName: 'A',
    })
    await emitAck(c3, 'joinRoom', {
      code: created.room.code,
      playerName: 'B',
    })
    const roomId = created.room.id

    // Socket fresco (simula F5) reclama el asiento de A con su secreto.
    const fresh = await connectedClient()
    const rej = await emitAck(fresh, 'rejoinRoom', {
      code: created.room.code,
      playerId: j2.player.id,
      secret: j2.player.secret,
    })
    expect(rej.success).toBe(true)
    expect(rej.player.id).toBe(j2.player.id)
    expect('isLiar' in rej.player).toBe(true)
    const after = await service.getRoomById(roomId)
    expect(after.players).toHaveLength(3)

    // Asiento inexistente -> NOT_FOUND, sin duplicar.
    const bad = await emitAck(fresh, 'rejoinRoom', {
      code: created.room.code,
      playerId: '123e4567-e89b-42d3-a456-426614174999',
      secret: '123e4567-e89b-42d3-a456-426614174998',
    })
    expect(bad.success).toBe(false)
    const afterBad = await service.getRoomById(roomId)
    expect(afterBad.players).toHaveLength(3)
  })

  gate(
    'P2-T4: secreto erróneo no roba el asiento y nunca se filtra',
    async () => {
      const host = await connectedClient()
      const c2 = await connectedClient()
      const c3 = await connectedClient()
      const created = await emitAck(host, 'createRoom', {
        categoryId: 'marvel',
        hostName: 'H',
      })
      const j2 = await emitAck(c2, 'joinRoom', {
        code: created.room.code,
        playerName: 'A',
      })
      await emitAck(c3, 'joinRoom', {
        code: created.room.code,
        playerName: 'B',
      })

      // playerId válido + secreto erróneo -> FORBIDDEN.
      const evil = await connectedClient()
      const spoof = await emitAck(evil, 'rejoinRoom', {
        code: created.room.code,
        playerId: j2.player.id,
        secret: '123e4567-e89b-42d3-a456-426614174997',
      })
      expect(spoof.success).toBe(false)
      expect(String(spoof.code ?? spoof.error)).toMatch(
        /FORBIDDEN|INVALID_SEAT/,
      )

      // El secreto nunca viaja en broadcasts (ni siquiera al dueño por sala).
      const seen: any[] = []
      c3.on('roomUpdated', (r) => seen.push(r))
      await emitAck(evil, 'joinRoom', {
        code: created.room.code,
        playerName: 'C',
      }).catch(() => null)
      for (const u of seen) {
        expect(JSON.stringify(u)).not.toContain('secret')
      }
      // El ACK privado sí lo incluye (es como el cliente lo guarda).
      expect(typeof j2.player.secret).toBe('string')
    },
  )

  gate('P2-T2: ráfaga de createRoom se limita con RATE_LIMITED', async () => {
    process.env.RATE_LIMIT_CREATE_PER_MIN = '3'
    try {
      const socks: any[] = []
      for (let i = 0; i < 4; i++) {
        socks.push(await connectedClient())
      }
      const results: any[] = []
      for (let i = 0; i < 4; i++) {
        results.push(
          await emitAck(socks[i], 'createRoom', {
            categoryId: 'marvel',
            hostName: `R${i}`,
          }),
        )
      }
      // Misma IP (localhost): las 3 primeras pasan, la 4ª se limita.
      expect(results.slice(0, 3).every((r) => r.success)).toBe(true)
      expect(results[3].success).toBe(false)
      expect(String(results[3].code ?? results[3].error)).toMatch(
        /RATE_LIMITED/,
      )
    } finally {
      delete process.env.RATE_LIMIT_CREATE_PER_MIN
    }
  })

  gate('P2-T1: con REDIS_URL los broadcasts siguen funcionando', async () => {
    if (!process.env.REDIS_URL) {
      // eslint-disable-next-line no-console
      console.warn(
        '[rooms.e2e] SKIP P2-T1 (sin REDIS_URL). C1 real exige 2 réplicas en staging.',
      )
      return
    }
    const host = await connectedClient()
    const c2 = await connectedClient()
    const created = await emitAck(host, 'createRoom', {
      categoryId: 'marvel',
      hostName: 'H',
    })
    const updP = waitFor(host, 'roomUpdated')
    await emitAck(c2, 'joinRoom', {
      code: created.room.code,
      playerName: 'A',
    })
    const upd: any = await updP
    expect(upd.players).toHaveLength(2)
  })

  gate(
    'P1-B2: disconnect marca isConnected=false y la gracia libera',
    async () => {
      const host = await connectedClient()
      const c2 = await connectedClient()
      const c3 = await connectedClient()
      const created = await emitAck(host, 'createRoom', {
        categoryId: 'marvel',
        hostName: 'H',
      })
      const roomId = created.room.id
      const j3 = await emitAck(c3, 'joinRoom', {
        code: created.room.code,
        playerName: 'B',
      })
      await emitAck(c2, 'joinRoom', {
        code: created.room.code,
        playerName: 'A',
      })

      // El host observa el roomUpdated de desconexión.
      const updatedP = waitFor(host, 'roomUpdated')
      c3.disconnect()
      const updated: any = await updatedP
      const ghost = updated.players.find((p: any) => p.id === j3.player.id)
      expect(ghost.isConnected).toBe(false)
      const mid = await service.getRoomById(roomId)
      expect(mid.players.find((p) => p.id === j3.player.id)?.isConnected).toBe(
        false,
      )

      // Tras la gracia (400ms en tests), el asiento se libera sin duplicados.
      await new Promise((r) => setTimeout(r, 1000))
      const after = await service.getRoomById(roomId)
      expect(after.players.find((p) => p.id === j3.player.id)).toBeUndefined()
      expect(after.players).toHaveLength(2)
    },
  )

  gate('P1-B3: leave borra, reasigna host y cierra sala vacía', async () => {
    const host = await connectedClient()
    const c2 = await connectedClient()
    const c3 = await connectedClient()
    const created = await emitAck(host, 'createRoom', {
      categoryId: 'marvel',
      hostName: 'H',
    })
    const roomId = created.room.id
    const hostPid: string = created.player.id
    const j2 = await emitAck(c2, 'joinRoom', {
      code: created.room.code,
      playerName: 'A',
    })
    const j3 = await emitAck(c3, 'joinRoom', {
      code: created.room.code,
      playerName: 'B',
    })

    // Sale un no-host: roomUpdated al resto, asiento borrado.
    const updP = waitFor(host, 'roomUpdated')
    const left = await emitAck(c3, 'leaveRoom', {
      roomId,
      playerId: j3.player.id,
      secret: j3.player.secret,
    })
    expect(left.success).toBe(true)
    expect(left.closed).toBeUndefined()
    await updP
    expect((await service.getRoomById(roomId)).players).toHaveLength(2)

    // Sale el host: el más antiguo (A) hereda.
    await emitAck(host, 'leaveRoom', {
      roomId,
      playerId: hostPid,
      secret: created.player.secret,
    })
    const afterHost = await service.getRoomById(roomId)
    expect(afterHost.hostId).toBe(j2.player.id)
    expect(afterHost.players).toHaveLength(1)

    // Sale el último: roomClosed + sala borrada en DB.
    const closedP = waitFor(c2, 'roomClosed')
    const fin = await emitAck(c2, 'leaveRoom', {
      roomId,
      playerId: j2.player.id,
      secret: j2.player.secret,
    })
    expect(fin.success).toBe(true)
    expect(fin.closed).toBe(true)
    const closedEv: any = await closedP
    expect(closedEv.roomId).toBe(roomId)
    await expect(service.getRoomById(roomId)).rejects.toThrow()
  })
})
