import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RoomStatus } from '@prisma/client'
import { getRandomCharacter } from '../constants/characters'

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

  async createRoom(categoryId: string, hostName: string) {
    const code = this.generateRoomCode()

    // Usar una transacción para crear la sala y el jugador host
    const result = await this.prisma.$transaction(async (prisma) => {
      // Primero crear la sala con un hostId temporal (UUID aleatorio)
      const tempHostId = 'temp-' + Math.random().toString(36).substring(7)

      const room = await prisma.room.create({
        data: {
          code,
          hostId: tempHostId,
          categoryId,
          status: RoomStatus.WAITING,
        },
      })

      // Crear el jugador host
      const hostPlayer = await prisma.player.create({
        data: {
          roomId: room.id,
          name: hostName,
        },
      })

      // Actualizar la sala con el hostId real
      const updatedRoom = await prisma.room.update({
        where: { id: room.id },
        data: { hostId: hostPlayer.id },
        include: {
          players: true,
        },
      })

      return { room: updatedRoom, player: hostPlayer }
    })

    return result
  }

  async getRoomByCode(code: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        players: {
          orderBy: { joinedAt: 'asc' },
        },
      },
    })

    if (!room) {
      throw new NotFoundException('Room not found')
    }

    return room
  }

  async getRoomById(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        players: {
          orderBy: { joinedAt: 'asc' },
        },
        votes: true,
      },
    })

    if (!room) {
      throw new NotFoundException('Room not found')
    }

    return room
  }

  async joinRoom(code: string, playerName: string) {
    const room = await this.getRoomByCode(code)

    if (room.status !== RoomStatus.WAITING) {
      throw new BadRequestException('Game already started')
    }

    const player = await this.prisma.player.create({
      data: {
        roomId: room.id,
        name: playerName,
      },
    })

    return { room, player }
  }

  async startGame(roomId: string) {
    const room = await this.getRoomById(roomId)

    if (room.players.length < 3) {
      throw new BadRequestException('Need at least 3 players to start')
    }

    if (room.status !== RoomStatus.WAITING) {
      throw new BadRequestException('Game already started')
    }

    // Seleccionar un mentiroso aleatorio
    const liarIndex = Math.floor(Math.random() * room.players.length)

    // Obtener un personaje aleatorio de la categoría seleccionada
    const character = getRandomCharacter(room.categoryId)

    // Actualizar jugadores
    await Promise.all(
      room.players.map((player, index) =>
        this.prisma.player.update({
          where: { id: player.id },
          data: {
            isLiar: index === liarIndex,
            // Solo asignar personaje a los jugadores honestos
            character: index === liarIndex ? null : character,
          },
        }),
      ),
    )

    // Actualizar estado de la sala
    const updatedRoom = await this.prisma.room.update({
      where: { id: roomId },
      data: {
        status: RoomStatus.PLAYING,
        startedAt: new Date(),
      },
      include: {
        players: {
          orderBy: { joinedAt: 'asc' },
        },
      },
    })

    return updatedRoom
  }

  async revealCharacter(playerId: string) {
    const player = await this.prisma.player.update({
      where: { id: playerId },
      data: { hasRevealed: true },
    })

    return player
  }

  async setPlayerReady(playerId: string) {
    const player = await this.prisma.player.update({
      where: { id: playerId },
      data: { isReady: true },
    })

    return player
  }

  async resetPlayerReady(playerId: string) {
    const player = await this.prisma.player.update({
      where: { id: playerId },
      data: { isReady: false },
    })

    return player
  }

  async deleteRoom(roomId: string) {
    await this.prisma.room.delete({
      where: { id: roomId },
    })
  }

  async startVoting(roomId: string) {
    const room = await this.getRoomById(roomId)

    if (room.status !== RoomStatus.PLAYING) {
      throw new BadRequestException('Can only start voting during gameplay')
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
          include: {
            voter: true,
            votedFor: true,
          },
        },
      },
    })

    return updatedRoom
  }

  async submitVote(roomId: string, voterId: string, votedForId: string) {
    const room = await this.getRoomById(roomId)

    if (room.status !== RoomStatus.VOTING) {
      throw new BadRequestException('Voting is not active')
    }

    // Verificar que el votante no esté eliminado
    const voter = room.players.find((p) => p.id === voterId)
    if (!voter || voter.isEliminated) {
      throw new BadRequestException('Player cannot vote')
    }

    // Verificar que no se vote a sí mismo
    if (voterId === votedForId) {
      throw new BadRequestException('Cannot vote for yourself')
    }

    // Verificar que el votado no esté eliminado
    const votedFor = room.players.find((p) => p.id === votedForId)
    if (!votedFor || votedFor.isEliminated) {
      throw new BadRequestException('Cannot vote for eliminated player')
    }

    // Crear o actualizar voto
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
      update: {
        votedForId,
      },
    })

    return vote
  }

  async getVotingResults(roomId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        players: {
          where: { isEliminated: false },
          orderBy: { joinedAt: 'asc' },
        },
        votes: {
          where: { round: undefined }, // Se actualizará después
          include: {
            voter: true,
            votedFor: true,
          },
        },
      },
    })

    if (!room) {
      throw new NotFoundException('Room not found')
    }

    // Actualizar la consulta de votos con el currentRound de la sala
    const roomWithVotes = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        players: {
          where: { isEliminated: false },
          orderBy: { joinedAt: 'asc' },
        },
        votes: {
          where: { round: room.currentRound },
          include: {
            voter: true,
            votedFor: true,
          },
        },
      },
    })

    if (!roomWithVotes) {
      throw new NotFoundException('Room not found')
    }

    // Contar votos
    const voteCounts = new Map<string, number>()
    roomWithVotes.votes.forEach((vote) => {
      const count = voteCounts.get(vote.votedForId) || 0
      voteCounts.set(vote.votedForId, count + 1)
    })

    // Encontrar al jugador más votado
    let mostVotedPlayerId: string | null = null
    let maxVotes = 0
    voteCounts.forEach((count, playerId) => {
      if (count > maxVotes) {
        maxVotes = count
        mostVotedPlayerId = playerId
      }
    })

    return {
      room: roomWithVotes,
      votes: roomWithVotes.votes,
      voteCounts: Object.fromEntries(voteCounts),
      mostVotedPlayerId,
      maxVotes,
    }
  }

  async processVotingResults(roomId: string) {
    const results = await this.getVotingResults(roomId)
    const { room, mostVotedPlayerId } = results

    if (!mostVotedPlayerId) {
      throw new BadRequestException('No votes cast')
    }

    // Encontrar al jugador más votado y al mentiroso
    const eliminatedPlayer = room.players.find(
      (p) => p.id === mostVotedPlayerId,
    )
    const liar = room.players.find((p) => p.isLiar)

    if (!eliminatedPlayer || !liar) {
      throw new NotFoundException('Player not found')
    }

    // Eliminar al jugador más votado
    await this.prisma.player.update({
      where: { id: mostVotedPlayerId },
      data: { isEliminated: true },
    })

    // Determinar si el juego continúa
    const liarCaught = eliminatedPlayer.id === liar.id
    let gameStatus: RoomStatus

    if (liarCaught) {
      // Los jugadores ganaron
      gameStatus = RoomStatus.FINISHED
    } else {
      // Contar jugadores activos (no eliminados, excepto el mentiroso)
      const activePlayers = room.players.filter(
        (p) => !p.isEliminated && p.id !== liar.id,
      )

      if (activePlayers.length <= 1) {
        // El mentiroso gana (solo queda 1 jugador o menos además del mentiroso)
        gameStatus = RoomStatus.FINISHED
      } else {
        // El juego continúa
        gameStatus = RoomStatus.PLAYING
      }
    }

    // Actualizar estado de la sala
    const updatedRoom = await this.prisma.room.update({
      where: { id: roomId },
      data: {
        status: gameStatus,
        currentRound:
          gameStatus === RoomStatus.PLAYING
            ? room.currentRound + 1
            : room.currentRound,
      },
      include: {
        players: {
          orderBy: { joinedAt: 'asc' },
        },
        votes: {
          where: { round: room.currentRound },
          include: {
            voter: true,
            votedFor: true,
          },
        },
      },
    })

    return {
      room: updatedRoom,
      eliminatedPlayer,
      liarCaught,
      liar,
      gameFinished: gameStatus === RoomStatus.FINISHED,
    }
  }
}
