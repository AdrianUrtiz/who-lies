import { Test, TestingModule } from '@nestjs/testing'
import { AppController } from './app.controller'
import { AppService } from './app.service'

describe('AppController', () => {
  let appController: AppController

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile()

    appController = app.get<AppController>(AppController)
  })

  describe('root', () => {
    // P0-T7: el scaffold esperaba "Hello World!" pero AppService devuelve "I am alive".
    it('should return "I am alive"', () => {
      expect(appController.getHello()).toBe('I am alive')
    })
  })
})
