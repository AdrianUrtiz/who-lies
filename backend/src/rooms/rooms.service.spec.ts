import { WsException } from '@nestjs/websockets'
import { RoomStatus } from '@prisma/client'
import { RoomsService } from './rooms.service'

/** Prisma mockeado: sin DB real. $transaction soporta callback y array. */
function makePrismaMock() {
  const delegates = {
    room: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    player: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    vote: {
      upsert: jest.fn(),
    },
  }
  const prisma: any = {
    ...delegates,
    $transaction: jest.fn((arg: any) => {
      if (typeof arg === 'function') return arg(delegates)
      return Promise.all(arg)
    }),
  }
  return { prisma, delegates }
}

function wsPayload(e: unknown): { code?: string; message?: string } {
  expect(e).toBeInstanceOf(WsException)
  return (e as WsException).getError() as { code?: string; message?: string }
}

const UUIDS = [
  '123e4567-e89b-42d3-a456-426614174001',
  '123e4567-e89b-42d3-a456-426614174002',
  '123e4567-e89b-42d3-a456-426614174003',
  '123e4567-e89b-42d3-a456-426614174004',
]
const HOST_ID = UUIDS[0]
const ROOM_ID = '123e4567-e89b-42d3-a456-426614174000'

function player(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    roomId: ROOM_ID,
    name: `P-${id.slice(-4)}`,
    character: 'Iron Man',
    isLiar: false,
    hasRevealed: false,
    isReady: false,
    isEliminated: false,
    joinedAt: new Date(),
    ...overrides,
  }
}

function room(status: RoomStatus, players: any[], currentRound = 1) {
  return {
    id: ROOM_ID,
    code: 'ABC123',
    hostId: HOST_ID,
    categoryId: 'marvel',
    status,
    createdAt: new Date(),
    startedAt: null,
    currentRound,
    players,
    votes: [],
  }
}

describe('RoomsService (unit, prisma mock)', () => {
  it('createRoom: reintenta ante colisión y valida categoría/nombre', async () => {
    const { prisma, delegates } = makePrismaMock()
    const service = new RoomsService(prisma)
    // generateUniqueRoomCode: 1ª existe, 2ª libre.
    delegates.room.findUnique
      .mockResolvedValueOnce({ id: 'x' })
      .mockResolvedValueOnce(null)
    const createdRoom = { id: ROOM_ID, code: 'ZZZZ99', hostId: 'temp-1' }
    const host = player(HOST_ID, { name: 'Host', roomId: ROOM_ID })
    delegates.room.create.mockResolvedValue(createdRoom)
    delegates.player.create.mockResolvedValue(host)
    delegates.room.update.mockResolvedValue({
      ...createdRoom,
      hostId: HOST_ID,
      players: [host],
    })

    const res = await service.createRoom('marvel', 'Host')
    expect(res.player.name).toBe('Host')
    expect(delegates.room.findUnique.mock.calls.length).toBeGreaterThanOrEqual(
      2,
    )

    await expect(service.createRoom('no-existe', 'Host')).rejects.toThrow()
    try {
      await service.createRoom('no-existe', 'Host')
    } catch (e) {
      expect(wsPayload(e).code).toBe('BAD_REQUEST')
    }
    await expect(service.createRoom('marvel', '   ')).rejects.toThrow()
  })

  it('joinRoom: rechaza si ya empezó (RoomStatus.PLAYING)', async () => {
    const { prisma, delegates } = makePrismaMock()
    const service = new RoomsService(prisma)
    delegates.room.findUnique.mockResolvedValue(
      room(RoomStatus.PLAYING, [player(UUIDS[0])]),
    )
    try {
      await service.joinRoom('ABC123', 'Tarde')
      throw new Error('no debería pasar')
    } catch (e) {
      if ((e as Error).message === 'no debería pasar') throw e
      const p = wsPayload(e)
      expect(p.code).toBe('BAD_REQUEST')
      expect(p.message).toMatch(/already started/i)
    }
  })

  it('startGame: exige 3 jugadores y solo host', async () => {
    const { prisma, delegates } = makePrismaMock()
    const service = new RoomsService(prisma)
    // Menos de 3.
    delegates.room.findUnique.mockResolvedValue(
      room(RoomStatus.WAITING, [player(UUIDS[0]), player(UUIDS[1])]),
    )
    await expect(service.startGame(ROOM_ID, HOST_ID)).rejects.toThrow(
      /at least 3/i,
    )

    // No-host.
    delegates.room.findUnique.mockResolvedValue(
      room(RoomStatus.WAITING, [
        player(UUIDS[0]),
        player(UUIDS[1]),
        player(UUIDS[2]),
      ]),
    )
    try {
      await service.startGame(ROOM_ID, UUIDS[1])
      throw new Error('no debería pasar')
    } catch (e) {
      if ((e as Error).message === 'no debería pasar') throw e
      expect(wsPayload(e).code).toBe('FORBIDDEN')
    }
  })

  it('submitVote: rechaza auto-voto y actor suplantado', async () => {
    const { prisma, delegates } = makePrismaMock()
    const service = new RoomsService(prisma)
    const players = [player(UUIDS[0]), player(UUIDS[1]), player(UUIDS[2])]
    delegates.room.findUnique.mockResolvedValue({
      ...room(RoomStatus.VOTING, players),
      votes: [],
    })

    await expect(
      service.submitVote(ROOM_ID, UUIDS[0], UUIDS[0]),
    ).rejects.toThrow(/yourself/i)

    // Actor distinto del votante -> FORBIDDEN.
    try {
      await service.submitVote(ROOM_ID, UUIDS[0], UUIDS[1], UUIDS[1])
      throw new Error('no debería pasar')
    } catch (e) {
      if ((e as Error).message === 'no debería pasar') throw e
      expect(wsPayload(e).code).toBe('FORBIDDEN')
    }
  })

  it('processVotingResults: empate no elimina y sigue en VOTING', async () => {
    const { prisma, delegates } = makePrismaMock()
    const service = new RoomsService(prisma)
    const players = [
      player(UUIDS[0], { isLiar: true, character: null }),
      player(UUIDS[1]),
      player(UUIDS[2]),
      player(UUIDS[3]),
    ]
    const votes = [
      { voterId: UUIDS[0], votedForId: UUIDS[1], round: 1 },
      { voterId: UUIDS[1], votedForId: UUIDS[0], round: 1 },
      { voterId: UUIDS[2], votedForId: UUIDS[0], round: 1 },
      { voterId: UUIDS[3], votedForId: UUIDS[1], round: 1 },
    ]
    delegates.room.findUnique.mockImplementation(async (args: any) => {
      if (args?.where?.id !== ROOM_ID) return null
      return { ...room(RoomStatus.VOTING, players), votes }
    })

    const res: any = await service.processVotingResults(ROOM_ID, HOST_ID)
    expect(res.tie).toBe(true)
    expect(res.eliminatedPlayer).toBeNull()
    expect(res.room.status).toBe(RoomStatus.VOTING)
    expect(delegates.player.update).not.toHaveBeenCalled()
  })

  it('processVotingResults: segundo concurrente falla (guard optimista)', async () => {
    const { prisma, delegates } = makePrismaMock()
    const service = new RoomsService(prisma)
    const players = [
      player(UUIDS[0]),
      player(UUIDS[1], { isLiar: true, character: null }),
      player(UUIDS[2]),
    ]
    const votes = [
      { voterId: UUIDS[0], votedForId: UUIDS[2], round: 1 },
      { voterId: UUIDS[1], votedForId: UUIDS[2], round: 1 },
      { voterId: UUIDS[2], votedForId: UUIDS[0], round: 1 },
    ]
    let call = 0
    delegates.room.findUnique.mockImplementation(async () => {
      call += 1
      // 1ª lectura (guard current): VOTING; siguientes: PLAYING (ya procesado).
      const status = call === 1 ? RoomStatus.VOTING : RoomStatus.PLAYING
      return { ...room(status, players), votes }
    })
    delegates.player.update.mockResolvedValue({})
    delegates.room.updateMany.mockResolvedValue({ count: 1 })

    const first = service.processVotingResults(ROOM_ID, HOST_ID)
    const second = service.processVotingResults(ROOM_ID, HOST_ID)
    const settled = await Promise.allSettled([first, second])
    const ok = settled.filter((r) => r.status === 'fulfilled')
    const bad = settled.filter((r) => r.status === 'rejected')
    expect(ok.length).toBe(1)
    expect(bad.length).toBe(1)
  })

  it('setConnected: marca presencia; P2025 -> NOT_FOUND', async () => {
    const { prisma, delegates } = makePrismaMock()
    const service = new RoomsService(prisma)
    delegates.player.update.mockResolvedValue({
      id: UUIDS[0],
      isConnected: false,
    })
    await expect(service.setConnected(UUIDS[0], false)).resolves.toMatchObject({
      isConnected: false,
    })

    await expect(service.setConnected('no-uuid', true)).rejects.toThrow()
    try {
      await service.setConnected('no-uuid', true)
    } catch (e) {
      expect(wsPayload(e).code).toBe('BAD_REQUEST')
    }
  })

  it('removePlayer: salida normal conserva sala y host', async () => {
    const { prisma, delegates } = makePrismaMock()
    const service = new RoomsService(prisma)
    const players = [player(UUIDS[0]), player(UUIDS[1]), player(UUIDS[2])]
    delegates.player.findUnique.mockResolvedValue(players[2])
    delegates.room.findUnique.mockResolvedValue(
      room(RoomStatus.WAITING, players),
    )
    delegates.player.delete.mockResolvedValue(players[2])
    delegates.player.findMany.mockResolvedValue([players[0], players[1]])

    const res = await service.removePlayer(UUIDS[2], ROOM_ID, UUIDS[2])
    expect(res.deleted).toBe(false)
    expect(res.newHostId).toBeNull()
    expect(delegates.room.delete).not.toHaveBeenCalled()
  })

  it('removePlayer: si era el host reasigna al más antiguo', async () => {
    const { prisma, delegates } = makePrismaMock()
    const service = new RoomsService(prisma)
    const players = [player(UUIDS[0]), player(UUIDS[1]), player(UUIDS[2])]
    delegates.player.findUnique.mockResolvedValue(players[0])
    delegates.room.findUnique.mockResolvedValue(
      room(RoomStatus.WAITING, players),
    )
    delegates.player.delete.mockResolvedValue(players[0])
    delegates.player.findMany.mockResolvedValue([players[1], players[2]])
    delegates.room.update.mockResolvedValue({ hostId: UUIDS[1] })

    const res = await service.removePlayer(UUIDS[0], ROOM_ID, UUIDS[0])
    expect(res.newHostId).toBe(UUIDS[1])
    expect(delegates.room.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ROOM_ID } }),
    )
  })

  it('removePlayer: último jugador borra la sala; actor ajeno FORBIDDEN', async () => {
    const { prisma, delegates } = makePrismaMock()
    const service = new RoomsService(prisma)
    const players = [player(UUIDS[0])]
    delegates.player.findUnique.mockResolvedValue(players[0])
    delegates.room.findUnique.mockResolvedValue(
      room(RoomStatus.WAITING, players),
    )
    delegates.player.delete.mockResolvedValue(players[0])
    delegates.player.findMany.mockResolvedValue([])
    delegates.room.delete.mockResolvedValue({})

    const res = await service.removePlayer(UUIDS[0], ROOM_ID, UUIDS[0])
    expect(res.deleted).toBe(true)
    expect(res.room).toBeNull()
    expect(delegates.room.delete).toHaveBeenCalled()

    await expect(
      service.removePlayer(UUIDS[0], ROOM_ID, UUIDS[1]),
    ).rejects.toThrow()
    try {
      await service.removePlayer(UUIDS[0], ROOM_ID, UUIDS[1])
    } catch (e) {
      expect(wsPayload(e).code).toBe('FORBIDDEN')
    }
  })

  it('cleanupExpired: filtros WAITING>24h sin conectados y FINISHED>7d', async () => {
    const { prisma, delegates } = makePrismaMock()
    const service = new RoomsService(prisma)
    delegates.room.deleteMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 })
    const now = new Date('2026-11-04T12:00:00Z')

    const res = await service.cleanupExpired(now)
    expect(res).toEqual({ waitingDeleted: 2, finishedDeleted: 1 })

    const [waitingWhere, finishedWhere] =
      delegates.room.deleteMany.mock.calls.map((c: any[]) => c[0].where)
    expect(waitingWhere.status).toBe(RoomStatus.WAITING)
    expect(waitingWhere.createdAt.lt).toEqual(
      new Date(now.getTime() - 24 * 60 * 60 * 1000),
    )
    expect(waitingWhere.players).toEqual({ none: { isConnected: true } })
    expect(finishedWhere.status).toBe(RoomStatus.FINISHED)
    expect(finishedWhere.finishedAt.lt).toEqual(
      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    )
  })
})
