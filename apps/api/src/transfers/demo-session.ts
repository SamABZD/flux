import { createHash, randomBytes } from 'node:crypto';
import {
  Controller,
  Get,
  Inject,
  Injectable,
  Post,
  Req,
  Res,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { DEMO_USER_ID } from '../finance/transaction-query';
import type { Environment } from '../config/environment';

export type SessionRequest = Request & { userId: string };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
@Injectable()
export class DemoSessionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService<Environment, true>,
  ) {}
  checkOrigin(request: Request) {
    const origin = request.get('origin');
    if (origin && origin !== this.config.get('FRONTEND_URL', { infer: true }))
      throw new ForbiddenException('Unrecognized request origin.');
    if (request.method !== 'GET' && request.get('x-flux-client') !== 'web')
      throw new ForbiddenException('A Flux client header is required.');
  }
  async resolve(request: Request) {
    const token = request.headers.cookie
      ?.split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('flux_session='))
      ?.slice(13);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const session = await this.prisma.demoSession.findUnique({ where: { tokenHash: hash(token) } });
    return session && session.expiresAt > new Date() ? session.userId : null;
  }
  async start(request: Request, response: Response) {
    this.checkOrigin(request);
    const existing = await this.resolve(request);
    if (existing) return { userId: existing, mode: 'demo' as const };
    const token = randomBytes(32).toString('hex');
    await this.prisma.demoSession.create({
      data: {
        tokenHash: hash(token),
        userId: DEMO_USER_ID,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    response.cookie('flux_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.secure,
      path: '/',
      maxAge: 7 * 86400000,
    });
    return { userId: DEMO_USER_ID, mode: 'demo' as const };
  }
}
@Injectable()
export class DemoSessionGuard implements CanActivate {
  constructor(@Inject(DemoSessionService) private readonly sessions: DemoSessionService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    this.sessions.checkOrigin(request);
    const userId = await this.sessions.resolve(request);
    if (!userId)
      throw new UnauthorizedException('Your demo session expired. Reconnect to continue.');
    request.userId = userId;
    return true;
  }
}
@Controller('session')
export class DemoSessionController {
  constructor(@Inject(DemoSessionService) private readonly sessions: DemoSessionService) {}
  @Post('demo') start(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.sessions.start(request, response);
  }
  @Get() async current(@Req() request: Request) {
    const userId = await this.sessions.resolve(request);
    if (!userId) throw new UnauthorizedException();
    return { userId, mode: 'demo' as const };
  }
}
