// Fluxo pela API HTTP, contra a stack real (MySQL, Redis, RabbitMQ) e os
// usuários do seed: autenticação, criação idempotente, perfis e ciclo de status.
//   docker compose exec api npm run test:e2e
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/shared/prisma/prisma.service.js';

const SENHA = 'senha-de-teste';

describe('corridas (e2e)', () => {
  let app: INestApplication<App>;
  let passageiro: string;
  let motorista: string;

  const login = async (email: string): Promise<string> => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password: SENHA }).expect(200);
    return `Bearer ${res.body.accessToken}`;
  };
  const mudarStatus = (token: string, id: string, status: string) =>
    request(app.getHttpServer()).patch(`/corridas/${id}/status`).set('Authorization', token).send({ status });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
    passageiro = await login('passageiro@teste.local');
    motorista = await login('motorista@teste.local');

    // O motorista do seed pode ter ficado com uma corrida ativa (uso manual,
    // execução anterior): sem finalizá-la, o aceite daria 409 por outro motivo.
    // Busca no banco porque o GET /corridas traz só as 50 mais recentes, e as
    // abertas podem empurrar a dele para fora. Finaliza pela API, com os eventos.
    const ativas = await app.get(PrismaService).corrida.findMany({
      where: { motorista: { email: 'motorista@teste.local' }, status: { in: ['aceita', 'em_andamento'] } },
    });
    for (const c of ativas) {
      if (c.status === 'aceita') await mudarStatus(motorista, c.id, 'em_andamento').expect(200);
      if (c.status === 'aceita' || c.status === 'em_andamento') await mudarStatus(motorista, c.id, 'finalizada').expect(200);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('sem token ou com token inválido: 401', async () => {
    await request(app.getHttpServer()).get('/corridas').expect(401);
    // Assinatura adulterada no primeiro caractere (o último pode cair só nos bits
    // de padding do base64 e não mudar a assinatura).
    const [cabecalho, payload, assinatura] = passageiro.split('.');
    const adulterado = [cabecalho, payload, (assinatura.startsWith('A') ? 'B' : 'A') + assinatura.slice(1)].join('.');
    await request(app.getHttpServer()).get('/corridas').set('Authorization', adulterado).expect(401);
  });

  it('fluxo feliz, com reenvio idempotente, 403 de perfil e 409 de status fora de ordem', async () => {
    const chave = randomUUID();
    const criar = () =>
      request(app.getHttpServer())
        .post('/corridas')
        .set('Authorization', passageiro)
        .set('Idempotency-Key', chave)
        .send({ origem: 'Centro', destino: 'Tijuca' });

    const { body: corrida } = await criar().expect(201);
    expect(corrida.status).toBe('solicitada');
    // Reenvio com a mesma chave: a mesma corrida, não uma nova.
    const { body: reenvio } = await criar().expect(201);
    expect(reenvio.id).toBe(corrida.id);

    // Passageiro não muda status; motorista não pula etapas.
    await mudarStatus(passageiro, corrida.id, 'aceita').expect(403);
    await mudarStatus(motorista, corrida.id, 'em_andamento').expect(409);

    await mudarStatus(motorista, corrida.id, 'aceita').expect(200);
    await mudarStatus(motorista, corrida.id, 'em_andamento').expect(200);
    const { body: finalizada } = await mudarStatus(motorista, corrida.id, 'finalizada').expect(200);
    expect(finalizada).toMatchObject({ status: 'finalizada', versao: 4 });

    // Passageiro acompanha a própria corrida.
    const { body: lida } = await request(app.getHttpServer())
      .get(`/corridas/${corrida.id}`)
      .set('Authorization', passageiro)
      .expect(200);
    expect(lida.id).toBe(corrida.id);
  });
});
