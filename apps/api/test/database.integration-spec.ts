import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/database/prisma.service';

describe('real PostgreSQL integration', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  test('executes a real Prisma query', async () => {
    const rows = await prisma.$queryRaw<{ value: number }[]>`SELECT 1::int AS value`;
    expect(rows).toEqual([{ value: 1 }]);
  });

  test('has the committed initialization migration applied', async () => {
    const migrations = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `;
    expect(migrations).toEqual(expect.arrayContaining([{ migration_name: '20260914000000_init' }]));
  });

  test('serves health from the complete application', async () => {
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
  });
});
