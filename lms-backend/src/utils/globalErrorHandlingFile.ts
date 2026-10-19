export class AppError extends Error {
  public isOperational: boolean;
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "invalid input") {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "user not found") {
    super(message, 404);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Conflict detected") {
    super(message, 409);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = "Internal server error") {
    super(message, 500);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string = "The service is unavailable") {
    super(message, 503);
  }
}

// Backward-compatible aliases for existing imports using older spellings.
export class UnauthorisedError extends UnauthorizedError {}

export class ServiceUnavailabelError extends ServiceUnavailableError {}