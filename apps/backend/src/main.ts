import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
// cookie-parser's default import miscompiles to `cookie_parser_1.default(...)`
// under this tsconfig (no esModuleInterop) and throws "is not a function" at
// runtime — the e2e smoke test never caught this because it builds a
// TestingModule directly and never executes main.ts's bootstrap(). helmet
// ships its own runtime `.default` shim so it isn't affected the same way.
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { validateProductionEnv } from './config/validate-production-env';

async function bootstrap() {
  validateProductionEnv();

  // Prisma maps BigInt columns (storageUsedBytes, sizeBytes) to native JS
  // bigint, which JSON.stringify cannot serialize on its own -- every
  // endpoint returning a DataRoom, File, or FileVersion would 500 on the
  // response, even though the underlying operation succeeded. Express's
  // res.json() respects toJSON() if present, so this fixes it globally
  // rather than transforming these fields in every DTO individually.
  (BigInt.prototype as unknown as { toJSON(): string }).toJSON = function (this: bigint) {
    return this.toString();
  };

  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Behind Nginx, trust X-Forwarded-For so req.ip reflects the real client —
  // audit logs and watermarks depend on an accurate IP address.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production',
      crossOriginEmbedderPolicy: nodeEnv === 'production',
    }),
  );

  app.use(cookieParser(configService.get<string>('COOKIE_SECRET')));

  app.enableCors({
    origin: [frontendUrl],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Data-Room-Id'],
  });

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('InsolvencyVDR API')
      .setDescription('Virtual Data Room platform for IBC insolvency professionals')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'access-token',
      )
      .addCookieAuth('refresh_token')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  await app.listen(port, '0.0.0.0');
  console.log(`InsolvencyVDR backend running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
