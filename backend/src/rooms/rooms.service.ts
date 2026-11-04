import { Injectable } from '@nestjs/common'
import { WsException } from '@nestjs/websockets'
import { PrismaService } from '../prisma/prisma.service'
import { RoomStatus } from '@prisma/client'
import { getRandomCharacter, CATEGORY_IDS } from '../constants/characters'
import { Prisma } from '@prisma/client'

export type WsCode = 'BAD_REQUEST' | 'NOT_FOUND' | 'CONFLICT' | 'FORBIDDEN'

function fail(code: WsCode, message: string): never {
  throw new WsException({ code, message })
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertUuid(value: unknown, code: WsCode, message: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    fail(code, message)
  }
  return value as string
}

function prismaErrorCode(e: unknown): string | undefined {
  const anyE = e as { code?: string }
  return typeof anyE?.code === 'string' ? anyE.code : undefined
}

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  /** P0-T4: código único con reintentos (evita P2002). */
  async generateUniqueRoomCode(maxAttempts = 5): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      const code = this.generateRoomCode()
      const existing = await this.prisma.room.findUnique({ where: { code } })
      if (!existing) return code
    }
    fail('CONFLICT', 'Could not generate unique room code')
  }

  private assertHost(room: { hostId: string }, requesterPlayerId: unknown) {
    const requester = assertUuid(
      requesterPlayerId,
      'FORBIDDEN',
      'INVALID_PLAYER_ID',
    )
    if (room.hostId !== requester) {
      fail('FORBIDDEN', 'Only the host can perform this action')
    }
    return requester
  }

  private assertActor(playerId: unknown, actorId: unknown) {
    const target = assertUuid(playerId, 'BAD_REQUEST', 'INVALID_PLAYER_ID')
    const actor = assertUuid(actorId, 'FORBIDDEN', 'NOT_JOINED')
    if (target !== actor) {
      fail('FORBIDDEN', 'Cannot act for another player')
    }
    return target
  }

  async createRoom(categoryId: string, hostName: string) {
    const cleanName = (hostName ?? '').trim()
    if (!cleanName || cleanName.length > 20) {
      fail('BAD_REQUEST', 'INVALID_NAME')
    }
    if (!CATEGORY_IDS.includes(categoryId)) {
      fail('BAD_REQUEST', 'INVALID_CATEGORY')
    }

    // Reintento ante colisión P2002 (P0-T4).
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = await this.generateUniqueRoomCode()
      try {
        const result = await this.prisma.$transaction(async (prisma) => {
          const tempHostId = 'temp-' + Math.random().toString(36).substring(7)

          const room = await prisma.room.create({
            data: {
              code,
              hostId: tempHostId,
              categoryId,
              status: RoomStatus.WAITING,
            },
          })

          const hostPlayer = await prisma.player.create({
            data: {
              roomId: room.id,
              name: cleanName,
            },
          })

          const updatedRoom = await prisma.room.update({
            where: { id: room.id },
            data: { hostId: hostPlayer.id },
            include: { players: true },
          })

          return { room: updatedRoom, player: hostPlayer }
        })
        return result
      } catch (e) {
        if (prismaErrorCode(e) === 'P2002' && attempt < 2) continue
        throw e
      }
    }
    fail('CONFLICT', 'Could not create room')
  }

  async getRoomByCode(code: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: {
        players: { orderBy: { joinedAt: 'asc' } },
      },
    })

    if (!room) {
      fail('NOT_FOUND', 'Room not found')
    }

    return room
  }

  async getRoomById(roomId: string) {
    assertUuid(roomId, 'BAD_REQUEST', 'INVALID_ROOM_ID')
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        players: { orderBy: { joinedAt: 'asc' } },
        votes: true,
      },
    })

    if (!room) {
      fail('NOT_FOUND', 'Room not found')
    }

    return room
  }

  async joinRoom(code: string, playerName: string) {
    const cleanName = (playerName ?? '').trim()
    if (!cleanName || cleanName.length > 20) {
      fail('BAD_REQUEST', 'INVALID_NAME')
    }
    const room = await this.getRoomByCode(code)

    if (room.status !== RoomStatus.WAITING) {
      fail('BAD_REQUEST', 'Game already started')
    }

    try {
      const player = await this.prisma.player.create({
        data: {
          roomId: room.id,
          name: cleanName,
        },
      })
      return { room, player }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) throw e
      throw e
    }
  }

  async startGame(roomId: string, requesterPlayerId: string) {
    assertUuid(roomId, 'BAD_REQUEST', 'INVALID_ROOM_ID')
    const room = await this.getRoomById(roomId)
    this.assertHost(room, requesterPlayerId)

    if (room.players.length < 3) {
      fail('BAD_REQUEST', 'Need at least 3 players to start')
    }

    if (room.status !== RoomStatus.WAITING) {
      fail('BAD_REQUEST', 'Game already started')
    }

    const liarIndex = Math.floor(Math.random() * room.players.length)
    const character = getRandomCharacter(room.categoryId)

    // P0-T5: transacción atómica (roles + estado) con guard optimista.
    // Si dos startGame concurrentes, solo uno gana el updateMany condicional.
    // (update individual por jugador: cada uno recibe valores distintos,
    // no admite updateMany; la atomicidad la da la transacción.)
    const ops = room.players.map((player, index) =>
      this.prisma.player.update({
        where: { id: player.id },
        data: {
          isLiar: index === liarIndex,
          character: index === liarIndex ? null : character,
        },
      }),
    )

    const tx = await this.prisma.$transaction([
      ...ops,
      this.prisma.room.updateMany({
        where: { id: roomId, status: RoomStatus.WAITING },
        data: { status: RoomStatus.PLAYING, startedAt: new Date() },
      }),
    ])
    const roomUpdate = tx[tx.length - 1] as { count: number }
    if (roomUpdate.count === 0) {
      fail('BAD_REQUEST', 'Game already started')
    }

    return this.getRoomById(roomId)
  }

  /** P0-T5: valida que el player pertenezca a la sala (anti-suplantación entre salas). */
  private async requirePlayerInRoom(playerId: string, roomId: string) {
    assertUuid(playerId, 'BAD_REQUEST', 'INVALID_PLAYER_ID')
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    })
    if (!player) fail('NOT_FOUND', 'Player not found')
    if (player.roomId !== roomId) {
      fail('BAD_REQUEST', 'Player does not belong to room')
    }
    return player
  }

  async revealCharacter(playerId: string, roomId?: string, actorId?: string) {
    if (actorId !== undefined) this.assertActor(playerId, actorId)
    if (roomId) await this.requirePlayerInRoom(playerId, roomId)
    try {
      return await this.prisma.player.update({
        where: { id: playerId },
        data: { hasRevealed: true },
      })
    } catch (e) {
      if (prismaErrorCode(e) === 'P2025') {
        fail('NOT_FOUND', 'Player not found')
      }
      throw e
    }
  }

  async setPlayerReady(playerId: string, roomId?: string, actorId?: string) {
    if (actorId !== undefined) this.assertActor(playerId, actorId)
    if (roomId) await this.requirePlayerInRoom(playerId, roomId)
    try {
      return await this.prisma.player.update({
        where: { id: playerId },
        data: { isReady: true },
      })
    } catch (e) {
      if (prismaErrorCode(e) === 'P2025') {
        fail('NOT_FOUND', 'Player not found')
      }
      throw e
    }
  }

  async resetPlayerReady(playerId: string) {
    try {
      return await this.prisma.player.update({
        where: { id: playerId },
        data: { isReady: false },
      })
    } catch (e) {
      if (prismaErrorCode(e) === 'P2025') {
        fail('NOT_FOUND', 'Player not found')
      }
      throw e
    }
  }

  async deleteRoom(roomId: string) {
    await this.prisma.room.delete({
      where: { id: roomId },
    })
  }

  /** P1-B2: marca presencia sin borrar el asiento. */
  async setConnected(playerId: string, connected: boolean) {
    assertUuid(playerId, 'BAD_REQUEST', 'INVALID_PLAYER_ID')
    try {
      return await this.prisma.player.update({
        where: { id: playerId },
        data: { isConnected: connected },
      })
    } catch (e) {
      if (prismaErrorCode(e) === 'P2025') {
        fail('NOT_FOUND', 'Player not found')
      }
      throw e
    }
  }

  /**
   * P1-B3: salida real. Borra al jugador (votos en cascada); si la sala queda
   * vacía la borra; si era el host reasigna al más antiguo.
   */
  async removePlayer(playerId: string, roomId: string, actorId?: string) {
    if (actorId !== undefined) this.assertActor(playerId, actorId)
    const player = await this.requirePlayerInRoom(playerId, roomId)
    const room = await this.getRoomById(roomId)

    await this.prisma.player.delete({ where: { id: player.id } })

    const remaining = await this.prisma.player.findMany({
      where: { roomId },
      orderBy: { joinedAt: 'asc' },
    })

    if (remaining.length === 0) {
      await this.prisma.room.delete({ where: { id: roomId } })
      return { room: null, deleted: true, newHostId: null as string | null }
    }

    if (room.hostId === player.id) {
      const newHostId = remaining[0].id
      const updated = await this.prisma.room.update({
        where: { id: roomId },
        data: { hostId: newHostId },
        include: {
          players: { orderBy: { joinedAt: 'asc' } },
          votes: true,
        },
      })
      return { room: updated, deleted: false, newHostId }
    }

    return {
      room: await this.getRoomById(roomId),
      deleted: false,
      newHostId: null as string | null,
    }
  }

  /**
   * P1-B4: borra salas WAITING abandonadas (>24h sin conectados) y
   * FINISHED terminadas hace >7d (medido por finishedAt, el fin real).
   * Retorna conteos para log/test.
   */
  async cleanupExpired(now = new Date()) {
    const waitingCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const finishedCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const waiting = await this.prisma.room.deleteMany({
      where: {
        status: RoomStatus.WAITING,
        createdAt: { lt: waitingCutoff },
        players: { none: { isConnected: true } },
      },
    })
    const finished = await this.prisma.room.deleteMany({
      where: {
        status: RoomStatus.FINISHED,
        finishedAt: { lt: finishedCutoff },
      },
    })
    return { waitingDeleted: waiting.count, finishedDeleted: finished.count }
  }

  async startVoting(roomId: string, requesterPlayerId: string) {
    assertUuid(roomId, 'BAD_REQUEST', 'INVALID_ROOM_ID')
    const room = await this.getRoomById(roomId)
    this.assertHost(room, requesterPlayerId)

    if (room.status !== RoomStatus.PLAYING) {
      fail('BAD_REQUEST', 'Can only start voting during gameplay')
    }

    const updatedRoom = await this.prisma.room.update({
      where: { id: roomId },
      data: { status: RoomStatus.VOTING },
      include: {
        players: {
          where: { isEliminated: false },
          orderBy: { joinedAt: 'asc' },
        },
        votes: {
          where: { round: room.currentRound },
          include: { voter: true, votedFor: true },
        },
      },
    })

    return updatedRoom
  }

  async submitVote(
    roomId: string,
    voterId: string,
    votedForId: string,
    actorId?: string,
  ) {
    assertUuid(roomId, 'BAD_REQUEST', 'INVALID_ROOM_ID')
    if (actorId !== undefined) this.assertActor(voterId, actorId)
    const room = await this.getRoomById(roomId)

    if (room.status !== RoomStatus.VOTING) {
      fail('BAD_REQUEST', 'Voting is not active')
    }

    const voter = room.players.find((p) => p.id === voterId)
    if (!voter || voter.isEliminated) {
      fail('BAD_REQUEST', 'Player cannot vote')
    }

    if (voterId === votedForId) {
      fail('BAD_REQUEST', 'Cannot vote for yourself')
    }

    const votedFor = room.players.find((p) => p.id === votedForId)
    if (!votedFor || votedFor.isEliminated) {
      fail('BAD_REQUEST', 'Cannot vote for eliminated player')
    }

    const vote = await this.prisma.vote.upsert({
      where: {
        roomId_voterId_round: {
          roomId,
          voterId,
          round: room.currentRound,
        },
      },
      create: {
        roomId,
        voterId,
        votedForId,
        round: room.currentRound,
      },
      update: { votedForId },
    })

    return vote
  }

  async getVotingResults(roomId: string) {
    // P0: una sola lectura (antes hacía 2 findUnique, una con round:undefined).
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        players: {
          where: { isEliminated: false },
          orderBy: { joinedAt: 'asc' },
        },
        votes: true,
      },
    })

    if (!room) {
      fail('NOT_FOUND', 'Room not found')
    }

    const votes = room.votes.filter((v) => v.round === room.currentRound)

    const voteCounts = new Map<string, number>()
    for (const vote of votes) {
      voteCounts.set(
        vote.votedForId,
        (voteCounts.get(vote.votedForId) ?? 0) + 1,
      )
    }

    let maxVotes = 0
    for (const c of voteCounts.values()) {
      if (c > maxVotes) maxVotes = c
    }
    const topIds = [...voteCounts.entries()]
      .filter(([, c]) => c === maxVotes && maxVotes > 0)
      .map(([id]) => id)

    return {
      room: { ...room, votes },
      votes,
      voteCounts: Object.fromEntries(voteCounts),
      mostVotedPlayerId: topIds.length === 1 ? topIds[0] : null,
      tiedIds: topIds.length > 1 ? topIds : [],
      tie: topIds.length > 1,
      maxVotes,
    }
  }

  async processVotingResults(roomId: string, requesterPlayerId: string) {
    assertUuid(roomId, 'BAD_REQUEST', 'INVALID_ROOM_ID')
    // P0-T5: guard de estado antes de mutar + check de host.
    const current = await this.getRoomById(roomId)
    this.assertHost(current, requesterPlayerId)
    if (current.status !== RoomStatus.VOTING) {
      fail('BAD_REQUEST', 'Voting is not active')
    }

    const results = await this.getVotingResults(roomId)
    const { room } = results

    // P0-T6: empate -> no elimina, sigue en VOTING para revotar.
    if (results.tie || !results.mostVotedPlayerId) {
      if (!results.tie && !results.mostVotedPlayerId) {
        fail('BAD_REQUEST', 'No votes cast')
      }
      const votingRoom = await this.prisma.room.findUnique({
        where: { id: roomId },
        include: {
          players: { orderBy: { joinedAt: 'asc' } },
          votes: {
            where: { round: room.currentRound },
            include: { voter: true, votedFor: true },
          },
        },
      })
      return {
        room: votingRoom,
        eliminatedPlayer: null,
        liarCaught: false,
        liar: null,
        gameFinished: false,
        tie: true,
        tiedIds: results.tiedIds,
      }
    }

    const mostVotedPlayerId = results.mostVotedPlayerId as string
    const eliminatedPlayer = room.players.find(
      (p) => p.id === mostVotedPlayerId,
    )
    // El liar puede estar ya eliminado en rondas previas: buscarlo en sala completa.
    const full = await this.getRoomById(roomId)
    const liar = full.players.find((p) => p.isLiar)

    if (!eliminatedPlayer || !liar) {
      fail('NOT_FOUND', 'Player not found')
    }

    const liarCaught = eliminatedPlayer.id === liar.id
    let gameStatus: RoomStatus

    if (liarCaught) {
      gameStatus = RoomStatus.FINISHED
    } else {
      const activePlayers = room.players.filter(
        (p) => !p.isEliminated && p.id !== liar.id,
      )
      // Descontando al que será eliminado ahora: si quedaban 2 + liar, tras
      // eliminar a un inocente queda 1 + liar -> gana el liar.
      // room.players son los no-eliminados ANTES de esta eliminación.
      const remainingInnocents = activePlayers.filter(
        (p) => p.id !== eliminatedPlayer.id,
      )
      gameStatus =
        remainingInnocents.length <= 1
          ? RoomStatus.FINISHED
          : RoomStatus.PLAYING
    }

    // P0-T5: eliminación + avance de ronda atómicos con guard optimista.
    // Si dos processVoting concurrentes, solo uno gana el updateMany.
    const nextRound =
      gameStatus === RoomStatus.PLAYING
        ? room.currentRound + 1
        : room.currentRound
    const finished = gameStatus === RoomStatus.FINISHED
    const tx = await this.prisma.$transaction([
      this.prisma.player.update({
        where: { id: mostVotedPlayerId },
        data: { isEliminated: true },
      }),
      this.prisma.room.updateMany({
        where: { id: roomId, status: RoomStatus.VOTING },
        data: {
          status: gameStatus,
          currentRound: nextRound,
          // P1-B4: el TTL de FINISHED se mide desde el fin real.
          ...(finished ? { finishedAt: new Date() } : {}),
        },
      }),
    ])
    const roomTouched = tx[1] as { count: number }
    if (roomTouched.count === 0) {
      fail('BAD_REQUEST', 'Voting is not active')
    }
    const updatedRoom = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        players: { orderBy: { joinedAt: 'asc' } },
        votes: {
          where: { round: room.currentRound },
          include: { voter: true, votedFor: true },
        },
      },
    })
    if (!updatedRoom) fail('NOT_FOUND', 'Room not found')

    return {
      room: updatedRoom,
      eliminatedPlayer,
      liarCaught,
      // P0-T2: solo revelar al liar cuando termina (o fue cazado).
      liar: finished || liarCaught ? liar : null,
      gameFinished: finished,
      tie: false,
      tiedIds: [] as string[],
    }
  }

  /** P0-T5: continueGame en service con guard (antes estaba en gateway sin validar). */
  async continueGame(roomId: string, requesterPlayerId: string) {
    assertUuid(roomId, 'BAD_REQUEST', 'INVALID_ROOM_ID')
    const room = await this.getRoomById(roomId)
    this.assertHost(room, requesterPlayerId)
    if (room.status === RoomStatus.FINISHED) {
      fail('BAD_REQUEST', 'Game already finished')
    }
    if (
      room.status !== RoomStatus.PLAYING &&
      room.status !== RoomStatus.VOTING
    ) {
      fail('BAD_REQUEST', 'Cannot continue game in this state')
    }
    // Reset atómico en una sola query (mismo valor para todos -> updateMany).
    await this.prisma.player.updateMany({
      where: { roomId, isEliminated: false },
      data: { isReady: false, hasRevealed: false },
    })
    return this.getRoomById(roomId)
  }
}
