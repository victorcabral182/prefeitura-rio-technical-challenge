import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { RIDE_STATUSES, type RideStatus } from '../domain/ride-status.js';

// Limites iguais às colunas VARCHAR(255) do banco.
export class RequestRideDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  origem!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  destino!: string;
}

export class ChangeStatusDto {
  // 'solicitada' é só o status inicial; nenhuma transição volta para ele.
  @IsIn(RIDE_STATUSES.filter((status) => status !== 'solicitada'))
  status!: RideStatus;
}
