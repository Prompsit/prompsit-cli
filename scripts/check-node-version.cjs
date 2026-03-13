// Preinstall gate: abort npm install if Node.js version is too old.
// Must be plain CJS with var-only syntax to parse on ANY Node.js version.
// No dependencies available at preinstall time — ANSI codes for color.
"use strict";

var REQUIRED_MAJOR = 22;
var current = process.versions.node;
var major = parseInt(current.split(".")[0], 10);

if (major < REQUIRED_MAJOR) {
  var RED = "\x1b[31m";
  var YELLOW = "\x1b[33m";
  var BOLD = "\x1b[1m";
  var RESET = "\x1b[0m";

  var lines = [
    "",
    RED + BOLD + "ERROR: Node.js " + REQUIRED_MAJOR + "+ is required to install prompsit-cli" + RESET,
    RED + "  Current version: " + current + RESET,
    "",
    YELLOW + "How to upgrade:" + RESET,
  ];

  if (process.platform === "win32") {
    lines.push("  winget install OpenJS.NodeJS.LTS");
    lines.push("  -- or download from https://nodejs.org/");
  } else if (process.platform === "darwin") {
    lines.push("  brew install node@22");
    lines.push("  -- or: nvm install 22");
  } else {
    lines.push("  nvm install 22");
    lines.push("  -- or: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -");
    lines.push("         sudo apt-get install -y nodejs");
  }

  lines.push("");
  process.stderr.write(lines.join("\n") + "\n");
  process.exit(1);
}
