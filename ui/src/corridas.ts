export type StatusCorrida = 'solicitada' | 'aceita' | 'em_andamento' | 'finalizada'

// Mesmo formato do snapshot da api (RideSnapshot).
export type Corrida = {
  id: string
  origem: string
  destino: string
  status: StatusCorrida
  passageiroId: string
  motoristaId: string | null
  versao: number
  criadaEm: string
  atualizadaEm: string
}

export type Usuario = { id: string; type: 'passageiro' | 'motorista'; name: string }

export const STATUS_LABEL: Record<StatusCorrida, string> = {
  solicitada: 'Solicitada',
  aceita: 'Aceita',
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
}

// Próximo passo do motorista para cada status, com o texto do botão.
export const PROXIMA_ACAO: Partial<Record<StatusCorrida, { status: StatusCorrida; label: string }>> = {
  solicitada: { status: 'aceita', label: 'Aceitar' },
  aceita: { status: 'em_andamento', label: 'Iniciar' },
  em_andamento: { status: 'finalizada', label: 'Finalizar' },
}

export const mensagemDeErro = (erro: unknown) =>
  erro instanceof Error ? erro.message : 'Erro inesperado'
