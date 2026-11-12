import { Controller, Get } from '@nestjs/common';

// Liveness e readiness do Kubernetes. Não consulta MySQL, Redis nem RabbitMQ de
// propósito: se um deles cair, todas as réplicas falhariam a probe juntas. O
// Kubernetes tiraria todas do Service (ou as reiniciaria em loop), e o que ainda
// funciona sem o MySQL (GET /corridas/:id pelo cache) ficaria fora também.
@Controller('health')
export class AppController {
  @Get()
  health(): { status: string } {
    return { status: 'ok' };
  }
}
