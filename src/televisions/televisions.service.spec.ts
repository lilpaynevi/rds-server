import { Test, TestingModule } from '@nestjs/testing';
import { TelevisionsService } from './televisions.service';

describe('TelevisionsService', () => {
  let service: TelevisionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TelevisionsService],
    }).compile();

    service = module.get<TelevisionsService>(TelevisionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
