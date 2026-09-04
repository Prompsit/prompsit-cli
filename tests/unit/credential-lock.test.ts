import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

async function runChild(script: string, dataDir: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script],
      {
        env: { ...process.env, PROMPSIT_DATA_DIR: dataDir },
        stdio: "pipe",
      }
    );
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`credential lock child exited ${String(code)}: ${stderr}`));
    });
  });
}

afterEach(async () => {
  Reflect.deleteProperty(process.env, "PROMPSIT_DATA_DIR");
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("withCredentialLock", () => {
  it("serializes operations in separate processes", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "prompsit-lock-"));
    tempDirs.push(dataDir);
    const moduleUrl = pathToFileURL(resolve("src/config/credentials.ts")).href;
    const activePath = join(dataDir, "active");
    const script = `
      import { open, unlink } from "node:fs/promises";
      import { setTimeout as delay } from "node:timers/promises";
      import { withCredentialLock } from ${JSON.stringify(moduleUrl)};
      await withCredentialLock(async () => {
        const handle = await open(${JSON.stringify(activePath)}, "wx");
        await handle.close();
        await delay(100);
        await unlink(${JSON.stringify(activePath)});
      });
    `;

    await Promise.all([runChild(script, dataDir), runChild(script, dataDir)]);
  });

  it("recovers an abandoned stale lock", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "prompsit-lock-"));
    tempDirs.push(dataDir);
    process.env.PROMPSIT_DATA_DIR = dataDir;
    const lockPath = join(dataDir, "credentials.json.lock");
    await writeFile(lockPath, "abandoned", "utf8");
    const old = new Date(Date.now() - 180_000);
    await utimes(lockPath, old, old);
    const { withCredentialLock } = await import("../../src/config/credentials.ts");

    await expect(withCredentialLock(async () => "recovered")).resolves.toBe("recovered");
  });
});
