import { Module } from '@nestjs/common'
import { RoomsService } from './rooms.service'
import { RoomsGateway } from './rooms.gateway'
import { RoomsCleanupService } from './rooms-cleanup.service'

@Module({
  providers: [RoomsService, RoomsGateway, RoomsCleanupService],
  exports: [RoomsService],
})
export class RoomsModule {}
