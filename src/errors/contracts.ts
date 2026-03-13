import { z } from "zod";
import { ErrorCode } from "./codes.ts";
import { HttpStatus } from "../shared/constants.ts";

// RFC 9457 Problem Details for HTTP APIs.
export const ProblemDetailSchema = z.object({
  type: z.string().default("about:blank"),
  title: z.string().optional(),
  status: z.number().int().optional(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().optional(),
  trace_id: z.string().optional(),
});

export type ProblemDetail = z.infer<typeof ProblemDetailSchema>;

// Base application/API error contract used across layers.
export class APIError extends Error {
  public readonly code: string;
  public readonly statusCode: number | null;
  public readonly problem: ProblemDetail | null;

  constructor(
    message: string,
    code: string,
    statusCode: number | null = null,
    problem: ProblemDetail | null = null
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.problem = problem;
  }
}

export class AuthenticationError extends APIError {
  constructor(message = "Authentication failed") {
    super(message, ErrorCode.AUTH_FAILED, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenError extends APIError {
  constructor(message = "Access forbidden") {
    super(message, ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
  }
}

export class RateLimitError extends APIError {
  public readonly retryAfter: number | null;

  constructor(message = "Rate limit exceeded", retryAfter: number | null = null) {
    super(message, ErrorCode.RATE_LIMITED, HttpStatus.RATE_LIMITED);
    this.retryAfter = retryAfter;
  }
}

export class ServerError extends APIError {
  constructor(message = "Server error", statusCode = 500) {
    super(message, ErrorCode.SERVER_ERROR, statusCode);
  }
}

export class NetworkError extends APIError {
  constructor(message = "Network error") {
    super(message, ErrorCode.NETWORK, null);
  }
}

export class CancelledError extends APIError {
  constructor(message = "Request cancelled") {
    super(message, ErrorCode.CANCELLED, null);
  }
}

export class JobError extends APIError {
  constructor(message = "Job failed") {
    super(message, ErrorCode.JOB_FAILED, null);
  }
}

export class ValidationError extends APIError {
  public readonly errors: {
    type: string;
    loc: (string | number)[];
    msg: string;
    input?: unknown;
  }[];

  private static readonly FIELD_NAMES: Record<string, string> = {
    source_lang: "Source language",
    target_lang: "Target language",
    texts: "Text",
  };

  private static readonly ERROR_MESSAGES: Record<string, string> = {
    string_pattern_mismatch: "Invalid format. Use ISO codes like: en, es, fr, de, ca",
    missing: "This field is required",
    string_too_short: "Value is too short",
    string_too_long: "Value is too long",
  };

  constructor(
    errors: {
      type: string;
      loc: (string | number)[];
      msg: string;
      input?: unknown;
    }[]
  ) {
    const message = ValidationError.formatErrors(errors);
    super(message, ErrorCode.VALIDATION, HttpStatus.UNPROCESSABLE);
    this.errors = errors;
  }

  private static formatErrors(
    errors: {
      type: string;
      loc: (string | number)[];
      msg: string;
      input?: unknown;
    }[]
  ): string {
    const lines: string[] = [];

    for (const err of errors) {
      const field = err.loc.length > 0 ? String(err.loc.at(-1)) : "unknown";
      const fieldName =
        ValidationError.FIELD_NAMES[field] ??
        field.replaceAll("_", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase());
      const friendlyMsg = ValidationError.ERROR_MESSAGES[err.type] ?? err.msg;

      if (err.input !== undefined && err.input !== null) {
        lines.push(`${fieldName}: ${friendlyMsg} (got: ${JSON.stringify(err.input)})`);
      } else {
        lines.push(`${fieldName}: ${friendlyMsg}`);
      }
    }

    return lines.length > 0 ? lines.join("\n") : "Validation failed";
  }
}
