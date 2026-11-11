import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import {
  DriverBusyError,
  IdempotencyKeyReuseError,
  InvalidStatusTransitionError,
  RideConflictError,
  RideForbiddenError,
  RideNotFoundError,
  RidesError,
} from '../domain/errors.js';

// O domínio não conhece HTTP; a tradução de erro para status fica só aqui.
const HTTP_STATUS = new Map<abstract new (...args: never[]) => RidesError, HttpStatus>([
  [RideNotFoundError, HttpStatus.NOT_FOUND],
  [RideForbiddenError, HttpStatus.FORBIDDEN],
  [InvalidStatusTransitionError, HttpStatus.CONFLICT],
  [DriverBusyError, HttpStatus.CONFLICT],
  [RideConflictError, HttpStatus.CONFLICT],
  [IdempotencyKeyReuseError, HttpStatus.UNPROCESSABLE_ENTITY],
]);

@Catch(RidesError)
export class RidesErrorFilter implements ExceptionFilter {
  catch(error: RidesError, host: ArgumentsHost): void {
    const statusCode = HTTP_STATUS.get(error.constructor as typeof RidesError) ?? HttpStatus.INTERNAL_SERVER_ERROR;
    host.switchToHttp().getResponse<Response>().status(statusCode).json({ statusCode, message: error.message });
  }
}
