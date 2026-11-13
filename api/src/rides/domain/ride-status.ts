export const RIDE_STATUSES = ['solicitada', 'aceita', 'em_andamento', 'finalizada'] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

// O ciclo de vida é uma linha reta: cada status só avança para o próximo.
export const NEXT_STATUS: Partial<Record<RideStatus, RideStatus>> = {
  solicitada: 'aceita',
  aceita: 'em_andamento',
  em_andamento: 'finalizada',
};

// Um motorista só pode estar em uma corrida com estes status por vez.
export const ACTIVE_STATUSES: RideStatus[] = ['aceita', 'em_andamento'];
