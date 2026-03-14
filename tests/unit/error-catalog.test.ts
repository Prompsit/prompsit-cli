import { describe, expect, it } from "vitest";
import { classifyError } from "../../src/errors/catalog.ts";
import { init, t } from "../../src/i18n/index.ts";
import {
  APIError,
  AuthenticationError,
  JobError,
  NetworkError,
  RateLimitError,
  ServerError,
  ValidationError,
} from "../../src/errors/contracts.ts";
import { presentError } from "../../src/commands/error-presenter.ts";
import { enterReplMode, exitReplMode } from "../../src/runtime/execution-mode.ts";

init("en");

describe("error classification and presentation", () => {
  it.each([
    { exc: new AuthenticationError("Token expired"), expectedLabel: "Authentication error" },
    { exc: new RateLimitError("Too many requests"), expectedLabel: "Rate limit exceeded" },
    {
      exc: new ValidationError([{ type: "missing", loc: ["body", "texts"], msg: "required" }]),
      expectedLabel: "Invalid input",
    },
    { exc: new ServerError("Internal error", 500), expectedLabel: "Server error" },
    { exc: new NetworkError("Connection refused"), expectedLabel: "Network error" },
    { exc: new JobError("cancelled by user"), expectedLabel: "Job cancelled" },
    { exc: new JobError("processing failed"), expectedLabel: "Job failed" },
    {
      exc: new APIError("Unknown source language: eng", "E400", 400),
      expectedLabel: "Unsupported language",
    },
    {
      exc: new APIError("Unknown target language: deu", "E400", 400),
      expectedLabel: "Unsupported language",
    },
    {
      exc: new APIError("Unsupported language pair: xx-yy", "E400", 400),
      expectedLabel: "Unsupported language pair",
    },
    {
      exc: new APIError("Unsupported file format", "E400", 400),
      expectedLabel: "Unsupported format",
    },
    { exc: new APIError("Job abc123 not found", "E404", 404), expectedLabel: "Job not found" },
    { exc: new APIError("Something unexpected", "E400", 400), expectedLabel: "API error" },
  ])("$exc.message -> $expectedLabel", ({ exc, expectedLabel }) => {
    const presented = presentError(classifyError(exc), t);
    expect(presented.label).toBe(expectedLabel);
  });

  it("regex interpolation uses hint text as primary message", () => {
    const exc = new APIError("Unknown source language: eng", "E400", 400);
    const presented = presentError(classifyError(exc), t);

    expect(presented.hint).toBeNull();
    expect(presented.message).toContain("eng");
    expect(presented.message).toContain("prompsit translate --languages");
  });

  it("REPL mode strips 'prompsit' prefix from hint commands", () => {
    enterReplMode();
    try {
      const exc = new APIError("Unknown source language: eng", "E400", 400);
      const presented = presentError(classifyError(exc), t);

      expect(presented.message).toContain("eng");
      expect(presented.message).toContain("translate --languages");
      expect(presented.message).not.toContain("prompsit translate");
    } finally {
      exitReplMode();
    }
  });

  it("fallback keeps raw message when no specific pattern matches", () => {
    const exc = new APIError("completely unknown error", "EUNKNOWN", 400);
    const presented = presentError(classifyError(exc), t);

    expect(presented.label).toBe("API error");
    expect(presented.message).toBe("completely unknown error");
    expect(presented.hint).toBeNull();
  });
});
