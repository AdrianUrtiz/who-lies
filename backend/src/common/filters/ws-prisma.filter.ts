import {
  ArgumentsHost,
  Catch,
  Logger,
  BadRequestException,
} from '@nestjs/common'
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets'
import { Socket } from 'socket.io'

export type WsErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'

export interface WsErrorPayload {
  code: WsErrorCode
  message: string
}

/**
 * Filtro WS dedicado (P0-T3).
 *
 * - Mapea errores conocidos de Prisma (P2002->CONFLICT, P2025->NOT_FOUND).
 * - Registra el detalle real con Logger interno (servidor), nunca al cliente.
 * - Al cliente solo llega {code, message} sanitizado (sin stack ni SQL).
 *
 * Nota: el protocolo de este juego usa ACKs con forma
 * {success:false, code, error}. Los handlers devuelven esa forma en vez de
 * relanzar (probado: WsException lanzado va al evento 'exception' y el ACK
 * del cliente expira). Este filtro cubre errores no capturados
 * (p. ej. ValidationPipe u otros throws fuera del try/catch del handler).
 */
@Catch()
export class WsPrismaFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger('WsPrismaFilter')

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToWs()
    const client = ctx.getClient<Socket>()
    const payload = this.toPayload(exception)

    this.logger.warn(
      `WS error code=${payload.code} message=${payload.message} client=${client?.id ?? '?'}`,
    )

    // Sin volcar internals: solo código + mensaje corto y estable.
    super.catch(new WsException(payload), host)
  }

  toPayload(exception: unknown): WsErrorPayload {
    if (exception instanceof WsException) {
      const e = exception.getError() as
        | { code?: string; message?: string }
        | string
      if (typeof e === 'string') {
        return { code: 'BAD_REQUEST', message: e.slice(0, 300) }
      }
      return {
        code: this.asCode(e.code),
        message: String(e.message ?? 'Bad request').slice(0, 300),
      }
    }

    const anyErr = exception as {
      status?: number
      response?: { message?: string | string[] } | string
      message?: string
      code?: string
    }

    if (anyErr?.code === 'P2002') {
      return { code: 'CONFLICT', message: 'Duplicate value' }
    }
    if (anyErr?.code === 'P2025') {
      return { code: 'NOT_FOUND', message: 'Not found' }
    }

    const raw =
      (Array.isArray(
        (anyErr?.response as { message?: string[] } | undefined)?.message,
      )
        ? (
            (anyErr.response as { message?: string[] }).message as string[]
          ).join(', ')
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

    if (exception instanceof BadRequestException || status === 400) {
      return { code: 'BAD_REQUEST', message }
    }
    if (status === 404 || /not found/i.test(message)) {
      return { code: 'NOT_FOUND', message }
    }
    if (status === 409 || status === 403) {
      return { code: status === 409 ? 'CONFLICT' : 'FORBIDDEN', message }
    }
    if (/forbidden|not allowed|only host/i.test(message)) {
      return { code: 'FORBIDDEN', message }
    }
    return { code: 'BAD_REQUEST', message }
  }

  private asCode(code: string | undefined): WsErrorCode {
    if (
      code === 'NOT_FOUND' ||
      code === 'CONFLICT' ||
      code === 'FORBIDDEN' ||
      code === 'RATE_LIMITED' ||
      code === 'BAD_REQUEST'
    ) {
      return code
    }
    return 'BAD_REQUEST'
  }
}
