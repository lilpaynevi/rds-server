import { Test, TestingModule } from '@nestjs/testing';
import { TelevisionsController } from './televisions.controller';
import { TelevisionsService } from './televisions.service';

describe('TelevisionsController', () => {
  let controller: TelevisionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelevisionsController],
      providers: [TelevisionsService],
    }).compile();

    controller = module.get<TelevisionsController>(TelevisionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
