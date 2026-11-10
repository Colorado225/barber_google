export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError || (error instanceof Error && error.name === 'ApiError');
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback;
}
