// Teste de carga do fluxo do passageiro: cria uma corrida e lê pelo id.
//   docker compose run --rm k6
// Resumo no terminal e em loadtest/resultado.json; o lado do servidor
// (lag do worker, fila, CPU) fica no Prometheus durante a execução.
import http from 'k6/http';
import { check, sleep } from 'k6';

const API = __ENV.API_URL || 'http://api:3000';
// Usuários do seed (api/prisma/seed.ts), senha de teste.
const PASSAGEIROS = ['passageiro@teste.local', 'passageiro2@teste.local'];

export const options = {
  scenarios: {
    passageiros: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 50 },
        { duration: '3m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{nome:criar}': ['p(95)<500'],
    'http_req_duration{nome:ler}': ['p(95)<200'],
  },
};

// Login uma vez por VU, na primeira iteração: o access token dura 15 min, mais
// que o teste, e logar a cada iteração mediria o scrypt, não o fluxo de corridas.
// Não usa setup(): o retorno dele vai para o resultado.json, e token não se versiona.
let auth;

function login() {
  const email = PASSAGEIROS[__VU % PASSAGEIROS.length];
  const res = http.post(`${API}/auth/login`, JSON.stringify({ email, password: 'senha-de-teste' }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { nome: 'login' },
  });
  if (res.status !== 200) throw new Error(`login de ${email} falhou: ${res.status}`);
  return { Authorization: `Bearer ${res.json('accessToken')}` };
}

export default function () {
  auth ??= login();

  const criada = http.post(
    `${API}/corridas`,
    JSON.stringify({ origem: 'Centro', destino: `Destino ${__VU}-${__ITER}` }),
    {
      headers: { ...auth, 'Content-Type': 'application/json', 'Idempotency-Key': `k6-${__VU}-${__ITER}-${Date.now()}` },
      tags: { nome: 'criar' },
    },
  );
  if (!check(criada, { 'criou (201)': (r) => r.status === 201 })) return;

  const lida = http.get(`${API}/corridas/${criada.json('id')}`, { headers: auth, tags: { nome: 'ler' } });
  check(lida, { 'leu (200)': (r) => r.status === 200 });

  sleep(1);
}
