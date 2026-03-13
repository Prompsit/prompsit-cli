// See API-443: Error catalog with pattern matching and actionable hints.
// Classification only: this module must not depend on i18n runtime.

import type { APIError } from "./contracts.ts";
import {
  AuthenticationError,
  ForbiddenError,
  JobError,
  NetworkError,
  RateLimitError,
  ServerError,
  ValidationError,
} from "./contracts.ts";

interface ErrorRule {
  pattern: RegExp | null;
  labelKey: string;
  hintKey?: string;
  hintKwargs?: Record<string, string>;
  forceHintAsMessage?: boolean;
}

type ErrorClass = abstract new (...args: never[]) => APIError;

export interface ErrorClassification {
  labelKey: string;
  message: string;
  hintKey?: string;
  hintParams?: Record<string, string>;
  useHintAsMessage: boolean;
  code: string;
}

const ERROR_RULES = new Map<ErrorClass, ErrorRule[]>([
  [
    AuthenticationError,
    [
      {
        pattern: null,
        labelKey: "error.auth.label",
        hintKey: "error.auth.hint",
        hintKwargs: { cmd: "login -a EMAIL -s SECRET" },
      },
    ],
  ],
  [
    ForbiddenError,
    [
      {
        pattern: null,
        labelKey: "error.forbidden.label",
        hintKey: "error.forbidden.hint",
      },
    ],
  ],
  [
    RateLimitError,
    [
      {
        pattern: null,
        labelKey: "error.ratelimit.label",
        hintKey: "error.ratelimit.hint",
      },
    ],
  ],
  [
    ValidationError,
    [
      {
        pattern: null,
        labelKey: "error.validation.label",
        hintKey: "error.validation.hint",
        hintKwargs: { flag: "--help" },
      },
    ],
  ],
  [
    JobError,
    [
      {
        pattern: /cancel/i,
        labelKey: "error.job_cancelled.label",
      },
      {
        pattern: null,
        labelKey: "error.job_failed.label",
      },
    ],
  ],
  [
    ServerError,
    [
      {
        pattern: null,
        labelKey: "error.server.label",
        hintKey: "error.server.hint",
      },
    ],
  ],
  [
    NetworkError,
    [
      {
        pattern: /EPROTO/,
        labelKey: "error.network.label",
        hintKey: "error.network.ssl.hint",
      },
      {
        pattern: /ECONNREFUSED/,
        labelKey: "error.network.label",
        hintKey: "error.network.unavailable.hint",
      },
      {
        pattern: null,
        labelKey: "error.network.label",
        hintKey: "error.network.hint",
        forceHintAsMessage: true,
      },
    ],
  ],
]);

const GENERIC_API_ERROR_RULES: ErrorRule[] = [
  {
    pattern: /[Uu]nknown (?:source|target) language: (\S+)/,
    labelKey: "error.unsupported_lang.label",
    hintKey: "error.unsupported_lang.hint",
    hintKwargs: { cmd: "translate --languages" },
  },
  {
    pattern: /unsupported language pair/i,
    labelKey: "error.unsupported_pair.label",
    hintKey: "error.unsupported_pair.hint",
    hintKwargs: { cmd: "translate --languages" },
  },
  {
    pattern: /unsupported[^.]{0,200}format/i,
    labelKey: "error.unsupported_format.label",
    hintKey: "error.unsupported_format.hint",
    hintKwargs: { cmd: "translate --formats" },
  },
  {
    pattern: /job[^.]{0,100}not found/i,
    labelKey: "error.job_not_found.label",
  },
  {
    pattern: null,
    labelKey: "error.api.label",
  },
];

function buildHintParams(
  rule: ErrorRule,
  regexMatch: RegExpExecArray | null = null
): Record<string, string> | undefined {
  const params: Record<string, string> = {};

  if (regexMatch && regexMatch.length > 1) {
    for (let i = 1; i < regexMatch.length; i++) {
      params[String(i - 1)] = regexMatch[i] ?? "";
    }
  }

  if (rule.hintKwargs) {
    for (const [key, value] of Object.entries(rule.hintKwargs)) {
      params[key] = value;
    }
  }

  return Object.keys(params).length > 0 ? params : undefined;
}

export function classifyError(exc: APIError): ErrorClassification {
  let rules: ErrorRule[] | undefined;
  for (const [ErrorClass, classRules] of ERROR_RULES.entries()) {
    if (exc instanceof ErrorClass) {
      rules = classRules;
      break;
    }
  }

  rules ??= GENERIC_API_ERROR_RULES;

  for (const rule of rules) {
    if (rule.pattern === null) {
      return {
        labelKey: rule.labelKey,
        message: exc.message,
        hintKey: rule.hintKey,
        hintParams: buildHintParams(rule),
        useHintAsMessage: rule.forceHintAsMessage ?? false,
        code: exc.code,
      };
    }

    const match = rule.pattern.exec(exc.message);
    if (match) {
      return {
        labelKey: rule.labelKey,
        message: exc.message,
        hintKey: rule.hintKey,
        hintParams: buildHintParams(rule, match),
        useHintAsMessage: true,
        code: exc.code,
      };
    }
  }

  return {
    labelKey: "error.api.label",
    message: exc.message,
    useHintAsMessage: false,
    code: exc.code,
  };
}
