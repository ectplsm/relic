import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { parse, stringify, type TomlTable } from "smol-toml";
import { resolveCodexHome } from "./codex-home.js";

const CODEX_PROFILE_NAME = /^[A-Za-z0-9_-]+$/;
const RUNTIME_PROFILE_FILE = /^relic-runtime-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.config\.toml$/i;

export const CODEX_RUNTIME_PROFILE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface CodexRuntimeProfileOptions {
  developerInstructions: string;
  selectedProfile?: string;
  codexHome?: string;
}

export interface CodexRuntimeProfile {
  name: string;
  path: string;
  cleanup: () => void;
}

export interface CodexRuntimeProfileCleanupOptions {
  codexHome?: string;
  maxAgeMs?: number;
  now?: number;
}

export class CodexProfileError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "CodexProfileError";
  }
}

/**
 * Copy an optional user profile and append Relic's developer instructions.
 * The returned profile lives beside config.toml so relative paths keep the
 * same base directory as the selected user profile.
 */
export function createCodexRuntimeProfile(
  options: CodexRuntimeProfileOptions,
): CodexRuntimeProfile {
  if (options.developerInstructions.length === 0) {
    throw new CodexProfileError("Codex runtime profile requires developer instructions.");
  }

  const codexHome = options.codexHome
    ? resolveCodexHome({ codexHome: options.codexHome })
    : resolveCodexHome();
  cleanupStaleCodexRuntimeProfiles({ codexHome });

  const config = options.selectedProfile
    ? readSelectedProfile(codexHome, options.selectedProfile)
    : {};
  const existingInstructions = config.developer_instructions;
  if (existingInstructions !== undefined && typeof existingInstructions !== "string") {
    throw new CodexProfileError(
      "The selected Codex profile has a non-string developer_instructions value.",
    );
  }

  config.developer_instructions = existingInstructions
    ? `${existingInstructions}\n\n${options.developerInstructions}`
    : options.developerInstructions;

  const name = `relic-runtime-${randomUUID()}`;
  const path = join(codexHome, `${name}.config.toml`);
  mkdirSync(codexHome, { recursive: true });

  try {
    writeFileSync(path, stringify(config), {
      encoding: "utf-8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (!isFileAlreadyPresent(error)) removeFile(path);
    throw new CodexProfileError("Failed to create the Codex runtime profile.", error);
  }

  let cleaned = false;
  return {
    name,
    path,
    cleanup: () => {
      if (cleaned) return;
      cleaned = true;
      removeFile(path);
    },
  };
}

/** Remove only old Relic-owned runtime profiles. */
export function cleanupStaleCodexRuntimeProfiles(
  options: CodexRuntimeProfileCleanupOptions = {},
): number {
  const codexHome = options.codexHome
    ? resolveCodexHome({ codexHome: options.codexHome })
    : resolveCodexHome();
  const cutoff = (options.now ?? Date.now())
    - (options.maxAgeMs ?? CODEX_RUNTIME_PROFILE_MAX_AGE_MS);

  let removed = 0;
  let entries: string[];
  try {
    entries = readdirSync(codexHome);
  } catch {
    return removed;
  }

  for (const entry of entries) {
    if (!RUNTIME_PROFILE_FILE.test(entry)) continue;

    const path = join(codexHome, entry);
    try {
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.mtimeMs >= cutoff) continue;
      unlinkSync(path);
      removed += 1;
    } catch {
      // Stale cleanup is best-effort and must not block a new launch.
    }
  }

  return removed;
}

function readSelectedProfile(codexHome: string, profile: string): TomlTable {
  if (!CODEX_PROFILE_NAME.test(profile)) {
    throw new CodexProfileError(`Invalid Codex profile name: ${profile}`);
  }

  const path = join(codexHome, `${profile}.config.toml`);
  if (!existsSync(path)) {
    throw new CodexProfileError(`Selected Codex profile not found: ${profile}`);
  }

  try {
    return parse(readFileSync(path, "utf-8"), {
      integersAsBigInt: "asNeeded",
      unsafeKeyBehaviour: "throw",
    });
  } catch (error) {
    throw new CodexProfileError(`Failed to parse Codex profile: ${profile}`, error);
  }
}

function removeFile(path: string): void {
  try {
    unlinkSync(path);
  } catch {
    // Cleanup is idempotent and best-effort.
  }
}

function isFileAlreadyPresent(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "EEXIST";
}
