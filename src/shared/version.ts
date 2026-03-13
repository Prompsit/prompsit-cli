// CalVer version: YY.MMDD.HHMM from latest git metadata.
//
// Priority: PROMPSIT_BUILD_VERSION > git logs timestamp > package.json > current time.
// Runtime intentionally avoids spawning subprocesses.

import fs from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version: pkgVersion } = require("../../package.json") as { version: string };

let cached: string | null = null;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatCalVer(date: Date): string {
  const yy = pad2(date.getFullYear() % 100);
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const min = pad2(date.getMinutes());
  return `${yy}.${mm}${dd}.${hh}${min}`;
}

function looksLikeCalVer(value: string | undefined): value is string {
  if (!value) return false;
  return /^\d{1,2}\.\d{3,4}\.\d{3,4}$/.test(value.trim());
}

function findGitMarker(startDir: string): string | null {
  let current = resolve(startDir);
  for (;;) {
    const marker = join(current, ".git");
    if (fs.existsSync(marker)) return marker;

    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function resolveGitDirFromMarker(markerPath: string): string | null {
  try {
    const stat = fs.statSync(markerPath);
    if (stat.isDirectory()) return markerPath;
    if (!stat.isFile()) return null;

    const raw = fs.readFileSync(markerPath, "utf8");
    const match = /^gitdir:\s{0,100}(.+)$/im.exec(raw);
    if (!match) return null;
    return resolve(dirname(markerPath), match[1].trim());
  } catch {
    return null;
  }
}

function tryReadGitTimestamp(): Date | null {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const marker = findGitMarker(moduleDir) ?? findGitMarker(process.cwd());
  if (!marker) return null;

  const gitDir = resolveGitDirFromMarker(marker);
  if (!gitDir) return null;

  const logHeadPath = join(gitDir, "logs", "HEAD");
  if (!fs.existsSync(logHeadPath)) return null;

  try {
    const lines = fs
      .readFileSync(logHeadPath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const last = lines.at(-1);
    if (!last) return null;

    const tsMatch = />\s+(\d+)\s+[+-]\d{4}\t/.exec(last);
    if (!tsMatch) return null;

    const seconds = Number.parseInt(tsMatch[1], 10);
    if (!Number.isFinite(seconds)) return null;

    return new Date(seconds * 1000);
  } catch {
    return null;
  }
}

/** Get CalVer version string (YY.MMDD.HHMM). */
export function getVersion(): string {
  if (cached) return cached;

  const buildVersion = process.env.PROMPSIT_BUILD_VERSION?.trim();
  if (looksLikeCalVer(buildVersion)) {
    cached = buildVersion;
    return cached;
  }

  const gitDate = tryReadGitTimestamp();
  if (gitDate) {
    cached = formatCalVer(gitDate);
    return cached;
  }

  if (looksLikeCalVer(pkgVersion)) {
    cached = pkgVersion;
    return cached;
  }

  cached = formatCalVer(new Date());
  return cached;
}
