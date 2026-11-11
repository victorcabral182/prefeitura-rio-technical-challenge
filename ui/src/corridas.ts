export type StatusCorrida = 'solicitada' | 'aceita' | 'em_andamento' | 'finalizada'

export type Corrida = {
  id: string
  origem: string
  destino: string
  status: StatusCorrida
  criadaEm: string
}

export const STATUS_LABEL: Record<StatusCorrida, string> = {
  solicitada: 'Solicitada',
  aceita: 'Aceita',
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
}
