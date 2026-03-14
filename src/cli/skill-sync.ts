// Skill sync: deploy bundled skills to ~/.prompsit/skills/ (central),
// then create symlinks from each AI agent's skills directory.
//
// Three-state config (cli.skill_sync):
//   null  = never asked -> prompt on first interactive launch
//   true  = enabled -> version-check + sync on every launch
//   false = disabled -> skip silently
//
// Architecture:
//   assets/skills/{name}/SKILL.md ──copy──> ~/.prompsit/skills/{name}/SKILL.md
//                                           ↑ symlink from ~/.claude/skills/{name}
//                                           ↑ symlink from ~/.agents/skills/{name}
//                                           ↑ symlink from ~/.gemini/skills/{name}

import {
  existsSync,
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  lstatSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { getSettings, reloadSettings } from "../config/settings.ts";
import { writeConfigToml } from "../config/toml-io.ts";
import { getConfigDir } from "../config/paths.ts";
import { getVersion } from "../shared/version.ts";
import { getLogger } from "../logging/index.ts";
import { promptSelect } from "./prompts.ts";

const log = getLogger(import.meta.url);

interface AgentDef {
  name: string;
  rootDir: string;
  skillsSubDir: string;
}

// Paths per official docs + ln-004-agent-config-sync:
// Claude Code: ~/.claude/skills/        (anthropic docs)
// Codex CLI:   ~/.agents/skills/        (developers.openai.com/codex/skills)
// Gemini CLI:  ~/.gemini/skills/        (google-gemini/gemini-cli tutorials)
const AGENT_DEFS: readonly AgentDef[] = [
  { name: "Claude Code", rootDir: ".claude", skillsSubDir: "skills" },
  { name: "Codex CLI", rootDir: ".agents", skillsSubDir: "skills" },
  { name: "Gemini CLI", rootDir: ".gemini", skillsSubDir: "skills" },
];

const VERSION_MARKER = ".version";

// Windows: junction (works without admin). Linux/macOS: dir symlink.
const LINK_TYPE: "junction" | "dir" = process.platform === "win32" ? "junction" : "dir";

/** Central skills directory: ~/.prompsit/skills/ */
function getCentralSkillsDir(): string {
  return join(getConfigDir(), "skills");
}

/** Bundled skills directory: {project}/assets/skills/ (works from src/ and dist/) */
function getBundledSkillsDir(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return join(thisDir, "../../assets/skills");
}

/** Scan bundled assets/skills/ for skill directories (each must contain SKILL.md). */
function discoverBundledSkills(): string[] {
  const assetsDir = getBundledSkillsDir();
  if (!existsSync(assetsDir)) return [];
  return readdirSync(assetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(assetsDir, d.name, "SKILL.md")))
    .map((d) => d.name);
}

/** Discover agents whose root directory already exists in home. */
function discoverAgents(): AgentDef[] {
  const home = homedir();
  return AGENT_DEFS.filter((agent) => existsSync(join(home, agent.rootDir)));
}

/** Check if central skills need install/update. */
function needsUpdate(centralDir: string, currentVersion: string): boolean {
  const markerPath = join(centralDir, VERSION_MARKER);
  if (!existsSync(markerPath)) return true;
  try {
    return readFileSync(markerPath, "utf8").trim() !== currentVersion;
  } catch {
    return true;
  }
}

/** Copy bundled skills to central ~/.prompsit/skills/ and write .version marker. */
function installToCenter(skills: string[]): void {
  const centralDir = getCentralSkillsDir();
  const assetsDir = getBundledSkillsDir();

  for (const skill of skills) {
    const destDir = join(centralDir, skill);
    mkdirSync(destDir, { recursive: true });
    copyFileSync(join(assetsDir, skill, "SKILL.md"), join(destDir, "SKILL.md"));
  }

  writeFileSync(join(centralDir, VERSION_MARKER), getVersion(), "utf8");
  log.info("Skills installed to central store", { count: String(skills.length) });
}

/**
 * Ensure a single symlink: link → target.
 * Per ln-004 safety: check existing state before creating.
 */
function ensureSingleLink(target: string, link: string): void {
  const stat = lstatSync(link, { throwIfNoEntry: false });

  if (!stat) {
    symlinkSync(target, link, LINK_TYPE);
    return;
  }

  if (stat.isSymbolicLink()) {
    try {
      if (readlinkSync(link) === target) return; // already correct
    } catch {
      // readlink failed (broken symlink) → recreate below
    }
    rmSync(link, { recursive: true, force: true });
    symlinkSync(target, link, LINK_TYPE);
    return;
  }

  if (stat.isDirectory()) {
    // Regular dir — only replace if it's our v1 data (has .version marker inside)
    if (existsSync(join(link, VERSION_MARKER))) {
      rmSync(link, { recursive: true });
      symlinkSync(target, link, LINK_TYPE);
    } else {
      log.warn("Skipping (real directory, not ours)", { path: link });
    }
  }
}

/** Create/verify symlinks from each agent's skills dir to central store. */
function ensureSymlinks(agents: AgentDef[], skills: string[]): void {
  const centralDir = getCentralSkillsDir();
  const home = homedir();

  for (const agent of agents) {
    try {
      const agentSkillsDir = join(home, agent.rootDir, agent.skillsSubDir);
      mkdirSync(agentSkillsDir, { recursive: true });

      for (const skill of skills) {
        ensureSingleLink(join(centralDir, skill), join(agentSkillsDir, skill));
      }
    } catch {
      log.warn("Failed to sync skills", { agent: agent.name });
    }
  }
}

/** Full sync: install to center + ensure symlinks for all agents. */
function syncSkills(agents: AgentDef[]): void {
  const skills = discoverBundledSkills();
  if (skills.length === 0) {
    log.warn("No bundled skills found");
    return;
  }

  const centralDir = getCentralSkillsDir();
  if (needsUpdate(centralDir, getVersion())) {
    installToCenter(skills);
  }

  ensureSymlinks(agents, skills);
}

/** Run skill sync from settings screen (enable action). */
export function performSkillSync(): void {
  const agents = discoverAgents();
  if (agents.length === 0) {
    log.info("No AI agents detected, skipping skill sync");
    return;
  }
  syncSkills(agents);
  log.info("Skills synced from settings", { agents: String(agents.length) });
}

/** Remove all skill symlinks and central store (disable action). */
export function performSkillRemoval(): void {
  const home = homedir();
  const skills = discoverBundledSkills();

  // Remove agent symlinks
  for (const agent of AGENT_DEFS) {
    for (const skill of skills) {
      const link = join(home, agent.rootDir, agent.skillsSubDir, skill);
      const stat = lstatSync(link, { throwIfNoEntry: false });
      if (stat?.isSymbolicLink()) {
        rmSync(link, { recursive: true, force: true });
      }
    }
  }

  // Remove central store
  const centralDir = getCentralSkillsDir();
  if (existsSync(centralDir)) {
    rmSync(centralDir, { recursive: true });
  }

  log.info("Skills removed", { count: String(skills.length) });
}

/** Persist skill_sync value to config. */
function persistSkillSync(value: boolean): void {
  const settings = getSettings();
  settings.cli.skill_sync = value;
  writeConfigToml(settings);
  reloadSettings();
}

/**
 * Main entry point: run skill sync logic based on config state.
 *
 * - false  -> return immediately
 * - null   -> first-launch prompt (TTY only)
 * - true   -> version-check + sync
 */
export async function runSkillSync(): Promise<void> {
  const settings = getSettings();
  const { skill_sync } = settings.cli;

  if (skill_sync === false) return;

  if (skill_sync === true) {
    const agents = discoverAgents();
    if (agents.length > 0) syncSkills(agents);
    return;
  }

  // skill_sync === null — first launch, prompt user
  if (!process.stdin.isTTY || !process.stderr.isTTY) return;

  const agents = discoverAgents();
  if (agents.length === 0) {
    persistSkillSync(false);
    return;
  }

  const skills = discoverBundledSkills();
  if (skills.length === 0) {
    persistSkillSync(false);
    return;
  }

  const agentNames = agents.map((a) => a.name).join(", ");
  const skillList = skills.map((s) => `  \u2022 /${s}`).join("\n");
  const result = await promptSelect({
    title: "Prompsit CLI Skills",
    message: `Install AI agent skills for: ${agentNames}\nSkills teach AI assistants how to use Prompsit CLI commands.\n\n${skillList}`,
    options: [
      { label: "Yes, install skills", value: "yes" },
      { label: "No, skip", value: "no" },
    ],
  });

  if (result === "yes") {
    persistSkillSync(true);
    syncSkills(agents);
  } else {
    persistSkillSync(false);
  }
}
