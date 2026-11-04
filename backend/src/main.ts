import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { RedisIoAdapter } from './redis-io.adapter'
import { RedisService } from './common/redis/redis.service'

function parseOrigins(): string[] {
  return (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** P2-T3: falla rápido en arranque con env inválida (no P1001 críptico). */
function validateEnv(): void {
  const problems: string[] = []
  if (!process.env.DATABASE_URL) {
    problems.push('DATABASE_URL is required')
  } else if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL)) {
    problems.push('DATABASE_URL must be a postgres(ql):// URL')
  }
  if (process.env.PORT && !/^\d+$/.test(process.env.PORT)) {
    problems.push('PORT must be numeric')
  }
  for (const name of [
    'PRESENCE_GRACE_MS',
    'RATE_LIMIT_CREATE_PER_MIN',
    'RATE_LIMIT_JOIN_PER_MIN',
    'RATE_LIMIT_VOTE_PER_MIN',
    'RATE_LIMIT_DEFAULT_PER_MIN',
  ]) {
    const v = process.env[name]
    if (v !== undefined && (!/^\d+$/.test(v) || Number(v) <= 0)) {
      problems.push(`${name} must be a positive integer`)
    }
  }
  if (problems.length > 0) {
    throw new Error(`Invalid environment: ${problems.join('; ')}`)
  }
}

async function bootstrap() {
  validateEnv()
  const app = await NestFactory.create(AppModule)

  // P2-T3: hardening HTTP.
  app.use(helmet())

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

  // P2-T3: allowlist múltiple por env (CSV).
  const origins = parseOrigins()
  app.enableCors({
    origin: origins.length === 1 ? origins[0] : origins,
    credentials: true,
  })

  // P2-T1: adaptador Redis cuando hay REDIS_URL (si no, en memoria).
  let redis: RedisService | null = null
  try {
    redis = app.get(RedisService, { strict: false })
  } catch {
    redis = null
  }
  app.useWebSocketAdapter(new RedisIoAdapter(app, redis))

  const port = Number(process.env.PORT || 3001)
  await app.listen(port)

  console.log(`🚀 Backend running on http://localhost:${port}`)
}
bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})
