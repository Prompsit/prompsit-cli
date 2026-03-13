// Centralized runtime platform helpers.
// Avoids duplicated string literals ("win32", "darwin", "linux") across modules.

export const RuntimePlatform = {
  WINDOWS: "win32",
  MACOS: "darwin",
  LINUX: "linux",
} as const;

export type RuntimePlatform = (typeof RuntimePlatform)[keyof typeof RuntimePlatform];

export function getRuntimePlatform(): NodeJS.Platform {
  return process.platform;
}

export function isWindowsPlatform(platform: NodeJS.Platform = process.platform): boolean {
  return platform === RuntimePlatform.WINDOWS;
}

/** Detect WSL (Windows Subsystem for Linux) via $WSL_DISTRO_NAME. */
export function isWSL(): boolean {
  return Boolean(process.env.WSL_DISTRO_NAME);
}
