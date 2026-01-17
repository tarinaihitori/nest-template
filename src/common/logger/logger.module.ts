import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';
        const logLevel =
          configService.get<string>('LOG_LEVEL') ||
          (isProduction ? 'info' : 'debug');

        /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
        return {
          pinoHttp: {
            level: logLevel,

            // メッセージキーを 'message' に変更（CloudWatch標準）
            messageKey: 'message',

            // ISO 8601 タイムスタンプ（CloudWatch推奨形式）
            timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,

            // ログレベルを文字列（大文字）に変換
            formatters: {
              level: (label) => ({ level: label.toUpperCase() }),
            },

            // X-Ray対応の相関ID生成
            genReqId: (req) => {
              const correlationId = req.headers['x-correlation-id'] as string;
              if (correlationId) return correlationId;

              const xrayHeader = req.headers['x-amzn-trace-id'] as string;
              if (xrayHeader) {
                const rootMatch = xrayHeader.match(/Root=([^;]+)/);
                if (rootMatch) return rootMatch[1];
              }

              return randomUUID();
            },

            // X-Ray情報をログに追加
            customProps: (req) => {
              const xrayHeader = req.headers['x-amzn-trace-id'] as string;
              if (!xrayHeader) return {};

              const props: Record<string, string> = {};
              xrayHeader.split(';').forEach((part) => {
                const [key, value] = part.split('=');
                if (key && value) {
                  props[`xray_${key.toLowerCase()}`] = value;
                }
              });
              return props;
            },

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
              res: (res) => ({
                statusCode: res.statusCode,
              }),
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
              service:
                configService.get<string>('SERVICE_NAME') || 'nest-project',
              environment:
                configService.get<string>('NODE_ENV') || 'development',
              version: configService.get<string>('APP_VERSION') || '0.0.1',
            },
          },
        };
        /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
