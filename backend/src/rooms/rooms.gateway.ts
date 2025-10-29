import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { RoomsService } from './rooms.service'

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  constructor(private readonly roomsService: RoomsService) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage('createRoom')
  async handleCreateRoom(
    @MessageBody() data: { categoryId: string; hostName: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { room, player } = await this.roomsService.createRoom(
        data.categoryId,
        data.hostName,
      )

      // Unir al cliente a la sala
      await client.join(room.id)

      return { success: true, room, player }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { code: string; playerName: string },
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const { room, player } = await this.roomsService.joinRoom(
        data.code,
        data.playerName,
      )

      // Unir al cliente a la sala
      await client.join(room.id)

      // Obtener la sala actualizada con todos los jugadores
      const updatedRoom = await this.roomsService.getRoomById(room.id)

      // Notificar a todos en la sala que un nuevo jugador se unió
      this.server.to(room.id).emit('roomUpdated', updatedRoom)

      return { success: true, room: updatedRoom, player }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  @SubscribeMessage('startGame')
  async handleStartGame(@MessageBody() data: { roomId: string }) {
    try {
      const room = await this.roomsService.startGame(data.roomId)

      // Notificar a todos en la sala que el juego empezó
      this.server.to(room.id).emit('gameStarted', room)

      return { success: true, room }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  @SubscribeMessage('revealCharacter')
  async handleRevealCharacter(
    @MessageBody() data: { playerId: string; roomId: string },
  ) {
    try {
      const player = await this.roomsService.revealCharacter(data.playerId)
      const room = await this.roomsService.getRoomById(data.roomId)

      // Notificar a todos en la sala sobre la actualización
      this.server.to(data.roomId).emit('playerRevealed', { player, room })

      return { success: true, player }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  @SubscribeMessage('setPlayerReady')
  async handleSetPlayerReady(
    @MessageBody() data: { playerId: string; roomId: string },
  ) {
    try {
      const player = await this.roomsService.setPlayerReady(data.playerId)
      const room = await this.roomsService.getRoomById(data.roomId)

      // Notificar a todos en la sala sobre la actualización
      this.server.to(data.roomId).emit('playerReady', { player, room })

      return { success: true, player }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: { roomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.leave(data.roomId)
    return { success: true }
  }

  @SubscribeMessage('startVoting')
  async handleStartVoting(@MessageBody() data: { roomId: string }) {
    try {
      const room = await this.roomsService.startVoting(data.roomId)

      // Notificar a todos en la sala que comenzó la votación
      this.server.to(room.id).emit('votingStarted', room)

      return { success: true, room }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  @SubscribeMessage('submitVote')
  async handleSubmitVote(
    @MessageBody()
    data: {
      roomId: string
      voterId: string
      votedForId: string
    },
  ) {
    try {
      await this.roomsService.submitVote(
        data.roomId,
        data.voterId,
        data.votedForId,
      )

      // Notificar a todos en la sala que se registró un voto
      const room = await this.roomsService.getRoomById(data.roomId)
      this.server.to(data.roomId).emit('voteSubmitted', { room })

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  @SubscribeMessage('processVoting')
  async handleProcessVoting(@MessageBody() data: { roomId: string }) {
    try {
      const results = await this.roomsService.processVotingResults(data.roomId)

      // Notificar a todos en la sala sobre los resultados
      this.server.to(data.roomId).emit('votingResults', results)

      return { success: true, results }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  @SubscribeMessage('continueGame')
  async handleContinueGame(@MessageBody() data: { roomId: string }) {
    try {
      const room = await this.roomsService.getRoomById(data.roomId)

      // Resetear isReady de todos los jugadores activos para la nueva ronda
      const activePlayers = room.players.filter((p) => !p.isEliminated)
      await Promise.all(
        activePlayers.map((player) =>
          this.roomsService.resetPlayerReady(player.id),
        ),
      )

      // Obtener la sala actualizada
      const updatedRoom = await this.roomsService.getRoomById(data.roomId)

      // Notificar a todos que el juego continúa
      this.server.to(data.roomId).emit('gameContinued', updatedRoom)

      return { success: true, room: updatedRoom }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }
}
