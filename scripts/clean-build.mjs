import { readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

if (manifest.name !== "prompsit-cli") {
  throw new Error(`Refusing to clean unexpected project root: ${root}`);
}

rmSync(join(root, "dist"), { recursive: true, force: true });
rmSync(join(root, "tsconfig.tsbuildinfo"), { force: true });
