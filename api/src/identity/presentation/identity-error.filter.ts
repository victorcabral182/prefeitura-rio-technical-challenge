import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { IdentityError } from '../domain/errors.js';

// O domínio não conhece HTTP; aqui cada erro de identidade vira 401 com a
// mensagem genérica do próprio erro.
@Catch(IdentityError)
export class IdentityErrorFilter implements ExceptionFilter {
  catch(error: IdentityError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(HttpStatus.UNAUTHORIZED)
      .json({ statusCode: HttpStatus.UNAUTHORIZED, message: error.message });
  }
}
