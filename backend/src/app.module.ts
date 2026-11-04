import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { PrismaModule } from './prisma/prisma.module'
import { RoomsModule } from './rooms/rooms.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    RoomsModule,
  ],
})
export class AppModule {}
