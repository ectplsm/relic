const CODEX_PROFILE_NAME = /^[A-Za-z0-9_-]+$/;

const CODEX_RESUME_SUBCOMMANDS = new Set(["resume", "fork"]);

export interface ParsedCodexArgs {
  profile?: string;
  argsWithoutProfile: string[];
}

export class CodexArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexArgsError";
  }
}

function validateProfileName(profile: string): string {
  if (!CODEX_PROFILE_NAME.test(profile)) {
    throw new CodexArgsError(
      `Invalid Codex profile name "${profile}". Use only letters, numbers, hyphens, and underscores.`,
    );
  }

  return profile;
}

/**
 * Extract one Codex profile option while preserving all remaining arguments.
 */
export function parseCodexArgs(args: string[]): ParsedCodexArgs {
  let profile: string | undefined;
  const argsWithoutProfile: string[] = [];

  const setProfile = (value: string): void => {
    if (profile !== undefined) {
      throw new CodexArgsError("Only one Codex profile can be specified.");
    }
    profile = validateProfileName(value);
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--profile" || arg === "-p") {
      const value = args[index + 1];
      if (value === undefined) {
        throw new CodexArgsError(`${arg} requires a profile name.`);
      }
      setProfile(value);
      index += 1;
      continue;
    }

    if (arg.startsWith("--profile=")) {
      setProfile(arg.slice("--profile=".length));
      continue;
    }

    argsWithoutProfile.push(arg);
  }

  return { profile, argsWithoutProfile };
}

/**
 * Detect resume/fork as the first forwarded Codex argument.
 * Profile options must be removed with parseCodexArgs before calling this.
 */
export function isCodexResumeArgs(args: string[]): boolean {
  return CODEX_RESUME_SUBCOMMANDS.has(args[0] ?? "");
}
