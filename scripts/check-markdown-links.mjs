import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const files = execFileSync("git", ["ls-files", "*.md"], { encoding: "utf8" })
  .split(/\r?\n/)
  .filter((file) => file && existsSync(file));

const failures = [];
const linkPattern = /!?\[[^\]]*\]\(([^)\n]+)\)/g;

for (const file of files) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  let inFence = false;

  for (const [index, line] of lines.entries()) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    for (const match of line.matchAll(linkPattern)) {
      let target = match[1].trim();
      if (target.startsWith("<")) {
        const closing = target.indexOf(">");
        target = closing >= 0 ? target.slice(1, closing) : target;
      } else {
        target = target.split(/\s+["']/u, 1)[0];
      }

      if (/^(?:[a-z][a-z\d+.-]*:|#)/iu.test(target)) continue;
      target = target.split("#", 1)[0];
      if (!target || /[{}*|]/u.test(target)) continue;

      let decodedTarget;
      try {
        decodedTarget = decodeURIComponent(target);
      } catch {
        failures.push(`${file}:${index + 1}: invalid URL encoding in ${target}`);
        continue;
      }

      const resolvedTarget = resolve(dirname(file), decodedTarget);
      if (!existsSync(resolvedTarget)) {
        failures.push(`${file}:${index + 1}: missing ${target}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`Broken local Markdown links:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Markdown links OK (${files.length} tracked files checked)`);
}
