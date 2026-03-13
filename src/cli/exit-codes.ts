// See API-456: Exit code constants (POSIX standard)
// 0=success, 1=app error, 2=usage error, 130=SIGINT, 143=SIGTERM

/** Application error (API error, network error, auth error). */
export const APP_ERROR = 1;

/** Usage error (invalid arguments, missing required flags). */
export const USAGE_ERROR = 2;

/** Process interrupted by SIGINT (Ctrl+C). POSIX: 128 + signal 2. */
export const SIGINT_EXIT = 130;

/** Process terminated by SIGTERM. POSIX: 128 + signal 15. */
export const SIGTERM_EXIT = 143;
