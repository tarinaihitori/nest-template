import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getLoggerToken, LoggerModule } from 'nestjs-pino';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './../src/app.controller';
import { AppService } from './../src/app.service';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { beforeEach, describe, it, afterEach } from 'vitest';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  const mockLogger = {
    info: () => {},
    error: () => {},
    warn: () => {},
    debug: () => {},
    trace: () => {},
    setContext: () => {},
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot({
          pinoHttp: {
            level: 'silent',
          },
        }),
      ],
      controllers: [AppController],
      providers: [
        AppService,
        AllExceptionsFilter,
        {
          provide: getLoggerToken(AllExceptionsFilter.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
