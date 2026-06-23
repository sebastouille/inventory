import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

loadEnv({ path: ".env.local", override: true });
loadEnv({ path: ".env" });

function getCorsAllowedOrigins() {
  const rawOrigins = process.env.CORS_ALLOWED_ORIGINS ?? "http://localhost:3010,http://localhost:3014";
  return rawOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: getCorsAllowedOrigins(),
    credentials: true
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true
    })
  );

  await app.listen(process.env.PORT ?? 3011);
}

void bootstrap();
