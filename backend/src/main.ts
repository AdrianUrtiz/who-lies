import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // P0-T1: validación runtime global para HTTP.
  // Nota: NO se ejecuta sobre @MessageBody en WS (probe: el pipe global no
  // valida payloads WS); los handlers WS validan con parseDto en el gateway
  // y el service revalida lo crítico para llamadas directas.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // Configurar CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })

  const port = process.env.PORT || 3001
  await app.listen(port)

  console.log(`🚀 Backend running on http://localhost:${port}`)
}
bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
