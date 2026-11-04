import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { RoomsService } from './rooms.service'

/**
 * P1-B4: limpieza de salas abandonadas.
 * - WAITING >24h sin conectados -> borrar.
 * - FINISHED con finishedAt >7d -> borrar (fin real, no createdAt).
 */
@Injectable()
export class RoomsCleanupService {
  private readonly logger = new Logger(RoomsCleanupService.name)

  constructor(private readonly rooms: RoomsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    const res = await this.cleanNow()
    if (res.waitingDeleted > 0 || res.finishedDeleted > 0) {
      this.logger.log(
        `cleanup: waiting=${res.waitingDeleted} finished=${res.finishedDeleted}`,
      )
    }
  }

  async cleanNow(
    now?: Date,
  ): Promise<{ waitingDeleted: number; finishedDeleted: number }> {
    return this.rooms.cleanupExpired(now)
  }
}
