import 'reflect-metadata';
import { Body, Controller, Get, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import type { Server } from 'node:http';
import request from 'supertest';
import { configureApp } from '../src/configure-app';
import { HealthModule } from '../src/health/health.module';

class ProbeDto {
  @IsString() name!: string;
}

@Controller('_test')
class ProbeController {
  @Post() validate(@Body() body: ProbeDto): ProbeDto {
    return body;
  }
  @Get('failure') fail(): never {
    throw new Error('database-password-must-never-leak');
  }
}

describe('HTTP foundation', () => {
  let app: INestApplication<Server>;
  let server: Server;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [HealthModule],
      controllers: [ProbeController],
      providers: [
        {
          provide: ConfigService,
          useValue: new ConfigService({ FRONTEND_URL: 'http://localhost:3000' }),
        },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.init();
    server = app.getHttpServer();
  });
  afterAll(async () => {
    await app.close();
  });

  test('GET /health returns the contract and a generated request id', async () => {
    const response = await request(server)
      .get('/health')
      .set('X-Request-Id', 'untrusted-client-id')
      .expect(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toEqual(expect.stringMatching(/^[0-9a-f-]{36}$/));
  });

  test('permits the configured browser origin and exposes the request id', async () => {
    const response = await request(server)
      .get('/health')
      .set('Origin', 'http://localhost:3000')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(response.headers['access-control-expose-headers']).toBe('X-Request-Id');
  });

  test('does not grant CORS access to an unrelated origin', async () => {
    const response = await request(server)
      .get('/health')
      .set('Origin', 'https://unrelated.example')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).not.toBe('https://unrelated.example');
  });

  test('returns a consistent 404 without query values', async () => {
    const response = await request(server).get('/missing?secret=hidden').expect(404);
    expect(response.body).toMatchObject({ statusCode: 404, path: '/missing' });
    expect(response.body).toHaveProperty('requestId', response.headers['x-request-id']);

    expect(response.text).not.toContain('secret=hidden');
  });

  test('validates DTO fields and rejects unexpected fields', async () => {
    await request(server).post('/_test').send({ name: 'valid' }).expect(201, { name: 'valid' });
    await request(server).post('/_test').send({ name: 42 }).expect(400);
    await request(server).post('/_test').send({ name: 'valid', extra: true }).expect(400);
  });

  test('sanitizes unexpected failures', async () => {
    const response = await request(server).get('/_test/failure').expect(500);
    expect(response.body).toMatchObject({ statusCode: 500, message: 'Internal server error' });
    expect(response.text).not.toContain('database-password');
  });
});
