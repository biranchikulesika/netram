import type { ErrorCode } from "@netram/types";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 400,
  INVALID_STATE_TRANSITION: 409,
  NOT_DISCLOSED: 403,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown> | null;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown> | null) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.details = details ?? null;
  }

  static badRequest(message: string, details?: Record<string, unknown>): AppError {
    return new AppError("BAD_REQUEST", message, details);
  }

  static unauthorized(message = "Authentication required."): AppError {
    return new AppError("UNAUTHORIZED", message);
  }

  static forbidden(message = "You are not authorized to perform this action."): AppError {
    return new AppError("FORBIDDEN", message);
  }

  static notFound(message = "Resource not found."): AppError {
    return new AppError("NOT_FOUND", message);
  }

  static conflict(message: string, details?: Record<string, unknown>): AppError {
    return new AppError("CONFLICT", message, details);
  }

  static invalidTransition(message: string, details?: Record<string, unknown>): AppError {
    return new AppError("INVALID_STATE_TRANSITION", message, details);
  }

  static notDisclosed(message = "Details are not disclosed to this user."): AppError {
    return new AppError("NOT_DISCLOSED", message);
  }

  static internal(message = "An internal error occurred."): AppError {
    return new AppError("INTERNAL_ERROR", message);
  }
}
