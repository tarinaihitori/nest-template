import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        const logLevel =
          configService.get('LOG_LEVEL') || (isProduction ? 'info' : 'debug');

        return {
          pinoHttp: {
            level: logLevel,
            genReqId: (req) =>
              (req.headers['x-correlation-id'] as string) || randomUUID(),
            customLogLevel: (_req, res, err) => {
              if (res.statusCode >= 500 || err) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            serializers: {
              req: (req) => ({
                method: req.method,
                url: req.url,
                headers: {
                  host: req.headers.host,
                  'user-agent': req.headers['user-agent'],
                },
              }),
              res: (res) => ({ statusCode: res.statusCode }),
            },
            redact: ['req.headers.authorization', 'req.headers.cookie'],
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                },
            base: {
              service: configService.get('SERVICE_NAME') || 'nest-project',
            },
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
