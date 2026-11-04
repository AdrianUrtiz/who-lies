import { Module } from '@nestjs/common'
import { RoomsService } from './rooms.service'
import { RoomsGateway } from './rooms.gateway'
import { RoomsCleanupService } from './rooms-cleanup.service'
import { RedisService } from '../common/redis/redis.service'
import { WsRateLimitService } from '../common/rate-limit/ws-rate-limit.service'

@Module({
  providers: [
    RoomsService,
    RoomsGateway,
    RoomsCleanupService,
    RedisService,
    WsRateLimitService,
  ],
  exports: [RoomsService, RedisService, WsRateLimitService],
})
export class RoomsModule {}
