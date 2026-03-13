// See API-442: Error hierarchy with codes & RFC 9457 ProblemDetail
import {
  APIError,
  AuthenticationError,
  ForbiddenError,
  ProblemDetailSchema,
  RateLimitError,
  ServerError,
  ValidationError,
} from "../errors/contracts.ts";
import { HttpStatus } from "../shared/constants.ts";

// Re-export only symbols that external consumers actually import.
// ForbiddenError, ValidationError, ProblemDetailSchema are used internally by parseApiError().

// Parse API response and return appropriate exception
// Supports RFC 9457 ProblemDetail format with fallback payload normalization.
export function parseApiError(responseData: unknown, statusCode: number): APIError {
  // Check for RFC 9457 ProblemDetail format
  if (
    typeof responseData === "object" &&
    responseData !== null &&
    "type" in responseData &&
    "code" in responseData
  ) {
    try {
      const problem = ProblemDetailSchema.parse(responseData);
      const detail = problem.detail ?? "API error";

      // Map error codes to specific exception types (prefix-based)
      if (problem.code?.startsWith("AUTH_")) {
        return new AuthenticationError(detail);
      }
      if (problem.code?.startsWith("RATE_")) {
        return new RateLimitError(detail);
      }

      // Map by HTTP status for proper classification (5xx → ServerError, etc.)
      if (statusCode === HttpStatus.FORBIDDEN) return new ForbiddenError(detail);
      if (statusCode === HttpStatus.UNPROCESSABLE)
        return new ValidationError([{ type: "value_error", loc: [], msg: detail }]);
      if (statusCode >= HttpStatus.INTERNAL_ERROR) return new ServerError(detail, statusCode);

      return new APIError(detail, problem.code ?? "EUNKNOWN", statusCode, problem);
    } catch {
      // Fall through to other parsers
    }
  }

  // Check if it's a validation error (list of error objects)
  if (Array.isArray(responseData) && responseData.length > 0) {
    const first = responseData[0] as Record<string, unknown>;
    if ("type" in first && "loc" in first) {
      return new ValidationError(
        responseData as {
          type: string;
          loc: (string | number)[];
          msg: string;
          input?: unknown;
        }[]
      );
    }
  }

  // Check for FastAPI detail format
  if (
    typeof responseData === "object" &&
    responseData !== null &&
    "detail" in (responseData as Record<string, unknown>)
  ) {
    const { detail } = responseData as Record<string, unknown>;

    // detail can be a string or list of validation errors
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as Record<string, unknown>;
      if ("type" in first && "loc" in first) {
        return new ValidationError(
          detail as {
            type: string;
            loc: (string | number)[];
            msg: string;
            input?: unknown;
          }[]
        );
      }
    }

    if (typeof detail === "string") {
      return mapStatusToError(statusCode, detail);
    }
  }

  // Fallback to string representation
  if (typeof responseData === "string") {
    return mapStatusToError(statusCode, responseData);
  }

  // Last resort fallback
  return mapStatusToError(statusCode, String(responseData));
}

// Map HTTP status code to the appropriate error class instance
function mapStatusToError(statusCode: number, message: string): APIError {
  if (statusCode === HttpStatus.UNAUTHORIZED) return new AuthenticationError(message);
  if (statusCode === HttpStatus.FORBIDDEN) return new ForbiddenError(message);
  if (statusCode === HttpStatus.RATE_LIMITED) return new RateLimitError(message);
  if (statusCode === HttpStatus.UNPROCESSABLE)
    return new ValidationError([{ type: "value_error", loc: [], msg: message }]);
  if (statusCode >= HttpStatus.INTERNAL_ERROR) return new ServerError(message, statusCode);

  return new APIError(message, `E${statusCode}`, statusCode);
}

export {
  CancelledError,
  NetworkError,
  APIError,
  AuthenticationError,
  RateLimitError,
  ServerError,
} from "../errors/contracts.ts";
