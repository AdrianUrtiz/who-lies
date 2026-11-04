import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WsException,
} from '@nestjs/websockets'
import { UseFilters, Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { RoomsService } from './rooms.service'
import {
  toPublicRoom,
  toPrivatePlayer,
  toPublicPlayer,
} from './rooms-view.mapper'
import { WsPrismaFilter } from '../common/filters/ws-prisma.filter'
import {
  CreateRoomDto,
  JoinRoomDto,
  PlayerActionDto,
  HostRoomDto,
  RejoinDto,
  VoteDto,
} from './dto/rooms.dto'

type AckOk = { success: true; [k: string]: unknown }
type AckErr = { success: false; code: string; error: string }
type Ack = AckOk | AckErr

/**
 * Enmienda al plan P0 (desviación documentada T3):
 * el service lanza `throw new WsException({code, message})` y el gateway lo
 * mapea a ACK `{success:false, code, error}`. No se relanza en el gateway
 * porque el throw viaja al evento 'exception' y el ACK del cliente expira
 * (medido con probe WS), rompiendo el contrato ACK que usan frontend y e2e.
 */
function toWsError(error: unknown): AckErr {
  if (error instanceof WsException) {
    const e = error.getError() as { code?: string; message?: string } | string
    if (typeof e === 'string')
      return { success: false, code: 'BAD_REQUEST', error: e }
    const code =
      e.code === 'NOT_FOUND' ||
      e.code === 'CONFLICT' ||
      e.code === 'FORBIDDEN' ||
      e.code === 'BAD_REQUEST'
        ? e.code
        : 'BAD_REQUEST'
    return {
      success: false,
      code,
      error: String(e.message ?? 'Bad request').slice(0, 300),
    }
  }
  const anyErr = error as {
    status?: number
    response?: { message?: string | string[] } | string
    message?: string
    code?: string
  }
  // Prisma conocidos -> códigos estables sin filtrar SQL.
  if (anyErr?.code === 'P2002') {
    return { success: false, code: 'CONFLICT', error: 'Duplicate value' }
  }
  if (anyErr?.code === 'P2025') {
    return { success: false, code: 'NOT_FOUND', error: 'Not found' }
  }
  const raw =
    (Array.isArray(
      (anyErr?.response as { message?: string[] } | undefined)?.message,
    )
      ? ((anyErr.response as { message?: string[] }).message as string[]).join(
          ', ',
        )
      : typeof anyErr?.response === 'string'
        ? (anyErr.response as string)
        : (anyErr?.response as { message?: string } | undefined)?.message) ??
    anyErr?.message ??
    'Internal error'
  const message = (Array.isArray(raw) ? raw.join(', ') : String(raw)).slice(
    0,
    300,
  )
  const status: number | undefined =
    typeof anyErr?.status === 'number' ? anyErr.status : undefined
  const code =
    status === 404 || /not found/i.test(message)
      ? 'NOT_FOUND'
      : status === 409 || /unique|conflict/i.test(message)
        ? 'CONFLICT'
        : status === 403 || /forbidden|only host/i.test(message)
          ? 'FORBIDDEN'
          : 'BAD_REQUEST'
  // Sin stack ni detalle SQL: mensaje corto y estable para el cliente.
  return { success: false, code, error: message }
}

/**
 * Validación runtime manual de DTOs (P0-T1).
 * Evidencia: el ValidationPipe global NO se ejecuta sobre @MessageBody en WS
 * (probe: payload inválido pasó con success:true), así que se valida aquí con
 * class-validator directamente. El service revalida lo crítico (UUIDs,
 * nombres, pertenencia) para llamadas directas.
 */
async function parseDto<T extends object>(
  Cls: new () => T,
  plain: unknown,
): Promise<{ ok: true; value: T } | { ok: false; error: AckErr }> {
  const value = plainToInstance(Cls, plain)
  const errors = await validate(value, {
    whitelist: true,
    forbidNonWhitelisted: true,
  })
  if (errors.length > 0) {
    const first = errors[0]
    const constraintMsg =
      (first.constraints && Object.values(first.constraints)[0]) ||
      `Invalid ${first.property}`
    return {
      ok: false,
      error: {
        success: false,
        code: 'BAD_REQUEST',
        error: String(constraintMsg).slice(0, 300),
      },
    }
  }
  return { ok: true, value }
}

function socketPlayerId(client: Socket): string | undefined {
  return (client.data as { playerId?: string } | undefined)?.playerId
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
})
@UseFilters(WsPrismaFilter)
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RoomsGateway.name)

  /** P1-B2: presencia en memoria (una sola réplica; Redis queda para P2). */
  private bindings = new Map<string, { playerId: string; roomId: string }>()
  private playerSockets = new Map<string, Set<string>>()
  private graceTimers = new Map<string, NodeJS.Timeout>()

  @WebSocketServer()
  server: Server

  constructor(private readonly roomsService: RoomsService) {}

  /** Gracia de reconexión; configurable por env para tests. */
  private graceMs(): number {
    const v = Number(process.env.PRESENCE_GRACE_MS ?? 60000)
    return Number.isFinite(v) && v >= 0 ? v : 60000
  }

  /** Vincula socket<->jugador y cancela el timer de gracia si existía. */
  private track(client: Socket, playerId: string, roomId: string): void {
    this.cancelGrace(playerId)
    this.bindings.set(client.id, { playerId, roomId })
    ;(client.data as { playerId?: string }).playerId = playerId
    let set = this.playerSockets.get(playerId)
    if (!set) {
      set = new Set()
      this.playerSockets.set(playerId, set)
    }
    set.add(client.id)
  }

  private untrack(
    client: Socket,
  ): { playerId: string; roomId: string } | undefined {
    const b = this.bindings.get(client.id)
    this.bindings.delete(client.id)
    if (b) {
      const set = this.playerSockets.get(b.playerId)
      if (set) {
        set.delete(client.id)
        if (set.size === 0) this.playerSockets.delete(b.playerId)
      }
    }
    return b
  }

  private hasLiveSocket(playerId: string): boolean {
    const set = this.playerSockets.get(playerId)
    return !!set && set.size > 0
  }

  private cancelGrace(playerId: string): void {
    const t = this.graceTimers.get(playerId)
    if (t) {
      clearTimeout(t)
      this.graceTimers.delete(playerId)
    }
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`)
    const b = this.untrack(client)
    if (!b) return
    if (this.hasLiveSocket(b.playerId)) return // otra pestaña sigue dentro
    // Marca desconexión inmediata + gracia antes de liberar el asiento.
    void this.roomsService
      .setConnected(b.playerId, false)
      .then(async () => {
        try {
          const room = await this.roomsService.getRoomById(b.roomId)
          this.server.to(b.roomId).emit('roomUpdated', toPublicRoom(room))
        } catch {
          // La sala pudo borrarse entre tanto; nada que emitir.
        }
      })
      .catch(() => undefined)
    const ms = this.graceMs()
    const timer = setTimeout(() => {
      this.graceTimers.delete(b.playerId)
      if (this.hasLiveSocket(b.playerId)) return
      void this.roomsService
        .removePlayer(b.playerId, b.roomId, b.playerId)
        .then((res) => {
          if (res.deleted || !res.room) {
            this.server.to(b.roomId).emit('roomClosed', { roomId: b.roomId })
          } else {
            this.server.to(b.roomId).emit('roomUpdated', toPublicRoom(res.room))
          }
        })
        .catch(() => undefined)
    }, ms)
    // Evita que el timer mantenga vivo el proceso en tests.
    if (typeof timer.unref === 'function') timer.unref()
    this.graceTimers.set(b.playerId, timer)
  }

  private async emitPrivateRoles(roomId: string, fullRoom: any) {
    // P0-T2: cada socket recibe su rol por canal directo, el broadcast es público.
    try {
      const sockets = await this.server.in(roomId).fetchSockets()
      for (const s of sockets) {
        const playerId = (s.data as { playerId?: string } | undefined)?.playerId
        if (!playerId) continue
        const me = (fullRoom.players as any[]).find((p) => p.id === playerId)
        if (!me) continue
        this.server.to(s.id).emit('yourPlayerUpdated', toPrivatePlayer(me))
      }
    } catch {
      // No bloquea el flujo principal si el adaptador no soporta fetchSockets.
    }
  }

  @SubscribeMessage('createRoom')
  async handleCreateRoom(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<Ack> {
    try {
      const parsed = await parseDto(CreateRoomDto, raw)
      if (!parsed.ok) return parsed.error
      const data = parsed.value
      const { room, player } = await this.roomsService.createRoom(
        data.categoryId,
        data.hostName,
      )

      this.track(client, player.id, room.id)
      await client.join(room.id)

      return {
        success: true,
        room: toPublicRoom(room),
        player: toPrivatePlayer(player),
      }
    } catch (error: unknown) {
      return toWsError(error)
    }
  }

  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<Ack> {
    try {
      const parsed = await parseDto(JoinRoomDto, raw)
      if (!parsed.ok) return parsed.error
      const data = parsed.value
      const { room, player } = await this.roomsService.joinRoom(
        data.code,
        data.playerName,
      )

      this.track(client, player.id, room.id)
      try {
        await this.roomsService.setConnected(player.id, true)
      } catch {
        // Si la fila desapareció entre create y aquí, el catch global responde.
      }
      await client.join(room.id)

      const updatedRoom = await this.roomsService.getRoomById(room.id)

      this.server.to(room.id).emit('roomUpdated', toPublicRoom(updatedRoom))

      return {
        success: true,
        room: toPublicRoom(updatedRoom),
        player: toPrivatePlayer(player),
      }
    } catch (error: unknown) {
      return toWsError(error)
    }
  }

  /**
   * P1-B1: reentrada con el mismo asiento (tras F5 o caída breve).
   * No crea Player nuevo: reutiliza el existente y cancela la gracia.
   */
  @SubscribeMessage('rejoinRoom')
  async handleRejoinRoom(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<Ack> {
    try {
      const parsed = await parseDto(RejoinDto, raw)
      if (!parsed.ok) return parsed.error
      const data = parsed.value
      const room = await this.roomsService.getRoomByCode(data.code)
      const player = (room.players as any[]).find((p) => p.id === data.playerId)
      if (!player) {
        return { success: false, code: 'NOT_FOUND', error: 'Seat not found' }
      }

      this.track(client, player.id, room.id)
      let fresh = player
      try {
        fresh = await this.roomsService.setConnected(player.id, true)
      } catch {
        // La fila pudo borrarse (gracia expirada/leave): asiento perdido.
        return { success: false, code: 'NOT_FOUND', error: 'Seat not found' }
      }
      await client.join(room.id)

      const updatedRoom = await this.roomsService.getRoomById(room.id)
      this.server.to(room.id).emit('roomUpdated', toPublicRoom(updatedRoom))

      return {
        success: true,
        room: toPublicRoom(updatedRoom),
        player: toPrivatePlayer(fresh),
      }
    } catch (error: unknown) {
      return toWsError(error)
    }
  }

  @SubscribeMessage('startGame')
  async handleStartGame(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<Ack> {
    try {
      const parsed = await parseDto(HostRoomDto, raw)
      if (!parsed.ok) return parsed.error
      const data = parsed.value
      const bound = socketPlayerId(client)
      if (!bound) {
        return { success: false, code: 'FORBIDDEN', error: 'NOT_JOINED' }
      }
      if (bound !== data.requesterPlayerId) {
        return {
          success: false,
          code: 'FORBIDDEN',
          error: 'Cannot act for another player',
        }
      }
      const room = await this.roomsService.startGame(
        data.roomId,
        data.requesterPlayerId,
      )
      const publicRoom = toPublicRoom(room)

      this.server.to(room.id).emit('gameStarted', publicRoom)
      await this.emitPrivateRoles(room.id, room)

      // El host también necesita su rol privado en el ACK.
      const host = (room.players as any[]).find((p) => p.id === room.hostId)
      return {
        success: true,
        room: publicRoom,
        yourPlayer: host ? toPrivatePlayer(host) : null,
      }
    } catch (error: unknown) {
      return toWsError(error)
    }
  }

  @SubscribeMessage('revealCharacter')
  async handleRevealCharacter(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<Ack> {
    try {
      const parsed = await parseDto(PlayerActionDto, raw)
      if (!parsed.ok) return parsed.error
      const data = parsed.value
      const bound = socketPlayerId(client)
      if (!bound) {
        return { success: false, code: 'FORBIDDEN', error: 'NOT_JOINED' }
      }
      const player = await this.roomsService.revealCharacter(
        data.playerId,
        data.roomId,
        bound,
      )
      const room = await this.roomsService.getRoomById(data.roomId)

      // P0-T2: broadcast público (sin isLiar/character), nunca el player crudo.
      this.server.to(data.roomId).emit('playerRevealed', {
        player: toPublicPlayer(player, false),
        room: toPublicRoom(room),
      })

      return { success: true, player: toPrivatePlayer(player) }
    } catch (error: unknown) {
      return toWsError(error)
    }
  }

  @SubscribeMessage('setPlayerReady')
  async handleSetPlayerReady(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<Ack> {
    try {
      const parsed = await parseDto(PlayerActionDto, raw)
      if (!parsed.ok) return parsed.error
      const data = parsed.value
      const bound = socketPlayerId(client)
      if (!bound) {
        return { success: false, code: 'FORBIDDEN', error: 'NOT_JOINED' }
      }
      const player = await this.roomsService.setPlayerReady(
        data.playerId,
        data.roomId,
        bound,
      )
      const room = await this.roomsService.getRoomById(data.roomId)

      this.server.to(data.roomId).emit('playerReady', {
        player: toPublicPlayer(player, false),
        room: toPublicRoom(room),
      })

      return { success: true, player: toPrivatePlayer(player) }
    } catch (error: unknown) {
      return toWsError(error)
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<Ack> {
    try {
      const parsed = await parseDto(PlayerActionDto, raw)
      if (!parsed.ok) return parsed.error
      const data = parsed.value
      const bound = socketPlayerId(client)
      // Sin socket bindeado no hay asiento que liberar en este canal.
      if (!bound) {
        return { success: false, code: 'FORBIDDEN', error: 'NOT_JOINED' }
      }
      if (bound !== data.playerId) {
        return {
          success: false,
          code: 'FORBIDDEN',
          error: 'Cannot act for another player',
        }
      }
      // P1-B3: salida real (borra Player, reasigna host, borra sala vacía).
      // Se emite ANTES de sacar al socket para que el que sale también
      // reciba roomUpdated/roomClosed.
      const res = await this.roomsService.removePlayer(
        data.playerId,
        data.roomId,
        bound,
      )
      this.cancelGrace(data.playerId)
      if (res.deleted || !res.room) {
        this.server.to(data.roomId).emit('roomClosed', { roomId: data.roomId })
        this.untrack(client)
        client.leave(data.roomId)
        return { success: true, closed: true }
      }
      this.server.to(data.roomId).emit('roomUpdated', toPublicRoom(res.room))
      this.untrack(client)
      client.leave(data.roomId)
      return { success: true, room: toPublicRoom(res.room) }
    } catch (error: unknown) {
      return toWsError(error)
    }
  }

  @SubscribeMessage('startVoting')
  async handleStartVoting(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<Ack> {
    try {
      const parsed = await parseDto(HostRoomDto, raw)
      if (!parsed.ok) return parsed.error
      const data = parsed.value
      const bound = socketPlayerId(client)
      if (!bound) {
        return { success: false, code: 'FORBIDDEN', error: 'NOT_JOINED' }
      }
      if (bound !== data.requesterPlayerId) {
        return {
          success: false,
          code: 'FORBIDDEN',
          error: 'Cannot act for another player',
        }
      }
      const room = await this.roomsService.startVoting(
        data.roomId,
        data.requesterPlayerId,
      )

      this.server.to(room.id).emit('votingStarted', toPublicRoom(room))

      return { success: true, room: toPublicRoom(room) }
    } catch (error: unknown) {
      return toWsError(error)
    }
  }

  @SubscribeMessage('submitVote')
  async handleSubmitVote(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<Ack> {
    try {
      const parsed = await parseDto(VoteDto, raw)
      if (!parsed.ok) return parsed.error
      const data = parsed.value
      const bound = socketPlayerId(client)
      if (!bound) {
        return { success: false, code: 'FORBIDDEN', error: 'NOT_JOINED' }
      }
      await this.roomsService.submitVote(
        data.roomId,
        data.voterId,
        data.votedForId,
        bound,
      )

      const room = await this.roomsService.getRoomById(data.roomId)
      this.server
        .to(data.roomId)
        .emit('voteSubmitted', { room: toPublicRoom(room) })

      return { success: true }
    } catch (error: unknown) {
      return toWsError(error)
    }
  }

  @SubscribeMessage('processVoting')
  async handleProcessVoting(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<Ack> {
    try {
      const parsed = await parseDto(HostRoomDto, raw)
      if (!parsed.ok) return parsed.error
      const data = parsed.value
      const bound = socketPlayerId(client)
      if (!bound) {
        return { success: false, code: 'FORBIDDEN', error: 'NOT_JOINED' }
      }
      if (bound !== data.requesterPlayerId) {
        return {
          success: false,
          code: 'FORBIDDEN',
          error: 'Cannot act for another player',
        }
      }
      const results = await this.roomsService.processVotingResults(
        data.roomId,
        data.requesterPlayerId,
      )

      // P0-T2: liar solo viaja si terminó (o fue cazado); si no, null.
      // eliminatedPlayer/liar se sanean con la misma allowlist (nunca
      // isLiar en broadcast salvo FINISHED).
      const reveal = (results.room as any)?.status === 'FINISHED'
      const safeResults = {
        ...results,
        room: toPublicRoom(results.room),
        eliminatedPlayer: results.eliminatedPlayer
          ? toPublicPlayer(results.eliminatedPlayer, reveal)
          : null,
        liar: results.liar ? toPublicPlayer(results.liar, reveal) : null,
      }
      this.server.to(data.roomId).emit('votingResults', safeResults)

      return { success: true, results: safeResults }
    } catch (error: unknown) {
      return toWsError(error)
    }
  }

  @SubscribeMessage('continueGame')
  async handleContinueGame(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<Ack> {
    try {
      const parsed = await parseDto(HostRoomDto, raw)
      if (!parsed.ok) return parsed.error
      const data = parsed.value
      const bound = socketPlayerId(client)
      if (!bound) {
        return { success: false, code: 'FORBIDDEN', error: 'NOT_JOINED' }
      }
      if (bound !== data.requesterPlayerId) {
        return {
          success: false,
          code: 'FORBIDDEN',
          error: 'Cannot act for another player',
        }
      }
      const room = await this.roomsService.continueGame(
        data.roomId,
        data.requesterPlayerId,
      )
      const publicRoom = toPublicRoom(room)

      this.server.to(data.roomId).emit('gameContinued', publicRoom)

      return { success: true, room: publicRoom }
    } catch (error: unknown) {
      return toWsError(error)
    }
  }
}
