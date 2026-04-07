import type { EngramRepository } from "../ports/engram-repository.js";
import type { MikoshiClient } from "../ports/mikoshi.js";
import { MikoshiApiError } from "../ports/mikoshi.js";
import { computePersonaHash } from "../sync/persona-hash.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MikoshiPushOutcome = "created" | "updated" | "already_synced" | "conflict";

export interface MikoshiPushResult {
  outcome: MikoshiPushOutcome;
  engramId: string;
  engramName: string;
  /** クラウド側の canonical ID (created / updated 時に返る) */
  cloudEngramId?: string;
  /** 更新後の persona hash (updated 時) */
  newPersonaHash?: string;
  /** conflict 時のリモート側 hash */
  conflictRemoteHash?: string;
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

// ---------------------------------------------------------------------------
// Usecase
// ---------------------------------------------------------------------------

export class MikoshiPush {
  constructor(
    private readonly localRepo: EngramRepository,
    private readonly mikoshi: MikoshiClient,
  ) {}

  async execute(engramId: string): Promise<MikoshiPushResult> {
    // 1. ローカル Engram 読み込み
    const local = await this.localRepo.get(engramId);
    if (!local) throw new MikoshiPushEngramNotFoundError(engramId);

    const { soul, identity } = local.files;
    const localHash = computePersonaHash(soul, identity);
    if (!localHash) throw new MikoshiPushPersonaHashError(engramId);

    // 2. クラウド側を sourceEngramId で検索
    const cloudEngram = await this.mikoshi.getEngramBySourceId(engramId);

    // 3. クラウドに未登録 → 新規作成
    if (!cloudEngram) {
      const created = await this.mikoshi.createEngram({
        name: local.meta.name,
        sourceEngramId: engramId,
        description: local.meta.description,
        tags: local.meta.tags,
        soul,
        identity,
      });
      return {
        outcome: "created",
        engramId,
        engramName: local.meta.name,
        cloudEngramId: created.id,
      };
    }

    // 4. クラウドに存在 → sync-status で drift 確認
    const syncStatus = await this.mikoshi.getSyncStatus(cloudEngram.id);
    const remoteHash = syncStatus.persona.token?.hash ?? null;

    if (remoteHash && localHash === remoteHash) {
      return {
        outcome: "already_synced",
        engramId,
        engramName: local.meta.name,
        cloudEngramId: cloudEngram.id,
      };
    }

    // 5. Persona drift あり → 更新
    const expectedHash = remoteHash ?? "";
    try {
      const updated = await this.mikoshi.updatePersona(cloudEngram.id, {
        soul,
        identity,
        expectedRemotePersonaHash: expectedHash,
      });
      return {
        outcome: "updated",
        engramId,
        engramName: local.meta.name,
        cloudEngramId: cloudEngram.id,
        newPersonaHash: updated.persona.hash,
      };
    } catch (err) {
      if (err instanceof MikoshiApiError && err.isConflict && err.code === "PERSONA_CONFLICT") {
        const body = err.body as { currentPersona?: { hash?: string } } | undefined;
        return {
          outcome: "conflict",
          engramId,
          engramName: local.meta.name,
          cloudEngramId: cloudEngram.id,
          conflictRemoteHash: body?.currentPersona?.hash,
        };
      }
      throw err;
    }
  }
}
