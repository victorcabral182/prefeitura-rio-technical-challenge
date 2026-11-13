import type { Corrida, StatusCorrida, Usuario } from './corridas.ts'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Access token só em memória: um script injetado na página consegue usá-lo
// enquanto a aba está aberta, mas não copiá-lo de um storage. Ao recarregar, a
// sessão volta pelo cookie httpOnly do refresh.
let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null

// Um refresh por vez. A api faz detecção de reuso: dois refresh simultâneos com
// o mesmo cookie (StrictMode rodando o efeito de boot duas vezes, duas chamadas
// recebendo 401 juntas) revogariam todas as sessões do usuário.
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      accessToken = res.ok ? ((await res.json()) as { accessToken: string }).accessToken : null
      return res.ok
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

// credentials: o cookie do refresh só viaja para /auth (Path do cookie); nas
// outras rotas não muda nada.
async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  const res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' })

  // Token expirado: renova uma vez e repete. Se o refresh falhar, o 401 sobe e a UI volta ao login.
  if (res.status === 401 && retry && accessToken && (await refreshSession())) return request(path, init, false)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null
    const message = Array.isArray(body?.message) ? body.message.join('; ') : body?.message
    throw new ApiError(res.status, message ?? res.statusText)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const me = () => request<Usuario>('/auth/me')

export async function login(email: string, password: string): Promise<Usuario> {
  const session = await request<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  accessToken = session.accessToken
  return me()
}

export async function logout(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' }).catch(() => undefined)
  accessToken = null
}

export const listarCorridas = () => request<Corrida[]>('/corridas')

export const criarCorrida = (origem: string, destino: string, idempotencyKey: string) =>
  request<Corrida>('/corridas', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ origem, destino }),
  })

export const alterarStatus = (id: string, status: StatusCorrida) =>
  request<Corrida>(`/corridas/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
