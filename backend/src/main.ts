import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

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
