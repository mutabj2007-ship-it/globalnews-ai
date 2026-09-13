import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getRoot', () => {
    it('should return foundation-ready service info', () => {
      expect(appController.getRoot()).toEqual({
        name: 'globalnews-ai-backend',
        status: 'foundation-ready',
      });
    });
  });
});
