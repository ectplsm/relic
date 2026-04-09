import type { EngramRepository } from "../ports/engram-repository.js";
import type { MikoshiClient } from "../ports/mikoshi.js";
import { MikoshiApiError } from "../ports/mikoshi.js";
import { computePersonaHash } from "../sync/persona-hash.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MikoshiPushOutcome = "create_required" | "push_required" | "already_synced";

export interface MikoshiPushResult {
  outcome: MikoshiPushOutcome;
  engramId: string;
  engramName: string;
  /** クラウド側の canonical ID (existing remote only) */
  cloudEngramId?: string;
  remotePersonaHash?: string | null;
}

export interface MikoshiPushApplyResult {
  action: "created" | "updated";
  cloudEngramId: string;
  newPersonaHash?: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MikoshiPushEngramNotFoundError extends Error {
  constructor(public readonly engramId: string) {
    super(`Engram "${engramId}" not found locally`);
    this.name = "MikoshiPushEngramNotFoundError";
  }
}

export class MikoshiPushPersonaHashError extends Error {
  constructor(public readonly engramId: string) {
    super(`Cannot compute persona hash for "${engramId}" — SOUL.md or IDENTITY.md is missing`);
    this.name = "MikoshiPushPersonaHashError";
  }
}

export class MikoshiPushPersonaConflictError extends Error {
  constructor(
    public readonly engramId: string,
    public readonly conflictRemoteHash?: string,
  ) {
    super(`Persona conflict for "${engramId}"`);
    this.name = "MikoshiPushPersonaConflictError";
  }
}

// ---------------------------------------------------------------------------
// Usecase
// ---------------------------------------------------------------------------

export class MikoshiPush {
  constructor(
    private readonly localRepo: EngramRepository,
    private readonly mikoshi: MikoshiClient,
  ) {}

  async check(engramId: string): Promise<{
    result: MikoshiPushResult;
    apply?: () => Promise<MikoshiPushApplyResult>;
  }> {
    const local = await this.localRepo.get(engramId);
    if (!local) throw new MikoshiPushEngramNotFoundError(engramId);

    const { soul, identity } = local.files;
    const localHash = computePersonaHash(soul, identity);
    if (!localHash) throw new MikoshiPushPersonaHashError(engramId);

    const cloudEngram = await this.mikoshi.getEngramBySourceId(engramId);

    if (!cloudEngram) {
      return {
        result: {
          outcome: "create_required",
          engramId,
          engramName: local.meta.name,
          remotePersonaHash: null,
        },
        apply: async () => {
          const created = await this.mikoshi.createEngram({
            name: local.meta.name,
            sourceEngramId: engramId,
            description: local.meta.description,
            tags: local.meta.tags,
            soul,
            identity,
          });
          return {
            action: "created",
            cloudEngramId: created.id,
          };
        },
      };
    }

    const syncStatus = await this.mikoshi.getSyncStatus(cloudEngram.id);
    const remoteHash = syncStatus.persona.token?.hash ?? null;

    if (remoteHash && localHash === remoteHash) {
      return {
        result: {
          outcome: "already_synced",
          engramId,
          engramName: local.meta.name,
          cloudEngramId: cloudEngram.id,
          remotePersonaHash: remoteHash,
        },
      };
    }

    return {
      result: {
        outcome: "push_required",
        engramId,
        engramName: local.meta.name,
        cloudEngramId: cloudEngram.id,
        remotePersonaHash: remoteHash,
      },
      apply: async () => {
        const expectedHash = remoteHash ?? "";
        try {
          const updated = await this.mikoshi.updatePersona(cloudEngram.id, {
            soul,
            identity,
            expectedRemotePersonaHash: expectedHash,
          });
          return {
            action: "updated",
            cloudEngramId: cloudEngram.id,
            newPersonaHash: updated.persona.hash,
          };
        } catch (err) {
          if (err instanceof MikoshiApiError && err.isConflict && err.code === "PERSONA_CONFLICT") {
            const body = err.body as { currentPersona?: { hash?: string } } | undefined;
            throw new MikoshiPushPersonaConflictError(
              engramId,
              body?.currentPersona?.hash,
            );
          }
          throw err;
        }
      },
    };
  }

  async execute(engramId: string): Promise<MikoshiPushApplyResult | undefined> {
    const { result, apply } = await this.check(engramId);
    if (result.outcome === "already_synced" || !apply) {
      return undefined;
    }
    return apply();
  }
}
