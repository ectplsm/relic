import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import type { EngramRepository } from "../ports/engram-repository.js";
import { RELIC_FILE_MAP, resolveWorkspacePath } from "../../shared/openclaw.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClawPullPersonaFileDiff = "missing" | "same" | "different";

export interface ClawPullDiff {
  soulDiff: ClawPullPersonaFileDiff;
  identityDiff: ClawPullPersonaFileDiff;
  sourcePath: string;
  remoteSoul?: string;
  remoteIdentity?: string;
}

export type ClawPullOutcome = "pulled" | "already_synced";

export interface ClawPullResult {
  outcome: ClawPullOutcome;
  engramId: string;
  engramName: string;
  sourcePath: string;
  diff?: ClawPullDiff;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ClawPullEngramNotFoundError extends Error {
  constructor(public readonly engramId: string) {
    super(`Engram "${engramId}" not found locally. Use "relic claw extract" to import it first.`);
    this.name = "ClawPullEngramNotFoundError";
  }
}

export class ClawPullWorkspaceNotFoundError extends Error {
  constructor(public readonly path: string) {
    super(`Claw workspace not found at ${path}`);
    this.name = "ClawPullWorkspaceNotFoundError";
  }
}

export class ClawPullPersonaMissingError extends Error {
  constructor(public readonly path: string) {
    super(`No persona files (SOUL.md, IDENTITY.md) found in ${path}`);
    this.name = "ClawPullPersonaMissingError";
  }
}

// ---------------------------------------------------------------------------
// Usecase
// ---------------------------------------------------------------------------

export class ClawPull {
  constructor(private readonly localRepo: EngramRepository) {}

  /**
   * Phase 1: read workspace + diff. Does not write anything yet.
   *
   * Returns an `apply` closure when there are changes to write.
   */
  async check(
    agentName: string,
    options?: { openclawDir?: string },
  ): Promise<{
    result: ClawPullResult;
    apply?: () => Promise<void>;
  }> {
    const sourcePath = resolveWorkspacePath(agentName, options?.openclawDir);

    if (!existsSync(sourcePath)) {
      throw new ClawPullWorkspaceNotFoundError(sourcePath);
    }

    // 1. Local Engram must exist
    const local = await this.localRepo.get(agentName);
    if (!local) {
      throw new ClawPullEngramNotFoundError(agentName);
    }

    // 2. Read persona files from workspace
    const remoteSoul = await readOptionalFile(join(sourcePath, RELIC_FILE_MAP.soul!));
    const remoteIdentity = await readOptionalFile(join(sourcePath, RELIC_FILE_MAP.identity!));

    if (!remoteSoul && !remoteIdentity) {
      throw new ClawPullPersonaMissingError(sourcePath);
    }

    // 3. Diff
    const soulDiff = diffFile(local.files.soul, remoteSoul);
    const identityDiff = diffFile(local.files.identity, remoteIdentity);

    if (soulDiff !== "different" && identityDiff !== "different") {
      return {
        result: {
          outcome: "already_synced",
          engramId: agentName,
          engramName: local.meta.name,
          sourcePath,
        },
      };
    }

    const diff: ClawPullDiff = {
      soulDiff,
      identityDiff,
      sourcePath,
      remoteSoul,
      remoteIdentity,
    };

    // 4. Apply closure
    const apply = async () => {
      const fresh = await this.localRepo.get(agentName);
      if (!fresh) throw new ClawPullEngramNotFoundError(agentName);

      const updatedFiles = { ...fresh.files };
      if (soulDiff === "different" && remoteSoul) updatedFiles.soul = remoteSoul;
      if (identityDiff === "different" && remoteIdentity) updatedFiles.identity = remoteIdentity;

      await this.localRepo.save({
        meta: { ...fresh.meta, updatedAt: new Date().toISOString() },
        files: updatedFiles,
      });
    };

    return { result: { outcome: "pulled", engramId: agentName, engramName: local.meta.name, sourcePath, diff }, apply };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function readOptionalFile(filePath: string): Promise<string | undefined> {
  if (!existsSync(filePath)) return undefined;
  return readFile(filePath, "utf-8");
}

function diffFile(
  localContent: string | undefined,
  remoteContent: string | undefined,
): ClawPullPersonaFileDiff {
  if (!remoteContent) return "missing";
  if (!localContent) return "different";
  return normalizeContent(localContent) === normalizeContent(remoteContent) ? "same" : "different";
}

/** Trim trailing whitespace so minor formatting differences don't cause false diffs. */
function normalizeContent(content: string): string {
  return content.trimEnd();
}
