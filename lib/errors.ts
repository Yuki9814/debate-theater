import { ZodError } from "zod";

export class AppError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export class AIProviderError extends AppError {
  constructor(message: string, status = 502, code = "AI_PROVIDER_ERROR") {
    super(message, status, code);
    this.name = "AIProviderError";
  }
}

export class AIAuthenticationError extends AIProviderError {
  constructor(message = "AI Provider Authentication failed. Check your API keys.") {
    super(message, 401, "AI_AUTH_ERROR");
    this.name = "AIAuthenticationError";
  }
}

export class AIRateLimitError extends AIProviderError {
  constructor(message = "AI Provider rate limit exceeded.") {
    super(message, 429, "AI_RATE_LIMIT");
    this.name = "AIRateLimitError";
  }
}

export class AITimeoutError extends AIProviderError {
  constructor(message = "AI Provider request timed out.") {
    super(message, 504, "AI_TIMEOUT");
    this.name = "AITimeoutError";
  }
}

export function errorResponse(error: unknown, fallback: string, status = 400) {
  if (error instanceof AppError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return Response.json(
      {
        error: error.issues[0]?.message ?? fallback,
        code: "VALIDATION_ERROR",
      },
      { status },
    );
  }

  return Response.json(
    {
      error: fallback,
      code: "REQUEST_FAILED",
    },
    { status },
  );
}
