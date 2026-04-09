import type { EngramRepository } from "../ports/engram-repository.js";
import type { MikoshiClient, MikoshiEngramDetail } from "../ports/mikoshi.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MikoshiPullOutcome = "pulled" | "already_synced";

export interface MikoshiPullDiff {
  soulDiffers: boolean;
  identityDiffers: boolean;
  remoteSoul: string;
  remoteIdentity: string;
}

export interface MikoshiPullResult {
  outcome: MikoshiPullOutcome;
  engramId: string;
  engramName: string;
  cloudEngramId: string;
  diff?: MikoshiPullDiff;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MikoshiPullEngramNotFoundError extends Error {
  constructor(public readonly engramId: string) {
    super(`Engram "${engramId}" not found locally. Use "relic mikoshi pull" to create or update it.`);
    this.name = "MikoshiPullEngramNotFoundError";
  }
}

export class MikoshiPullCloudNotFoundError extends Error {
  constructor(public readonly sourceEngramId: string) {
    super(`Engram "${sourceEngramId}" not found on Mikoshi`);
    this.name = "MikoshiPullCloudNotFoundError";
  }
}

export class MikoshiPullPersonaMissingError extends Error {
  constructor(public readonly cloudEngramId: string) {
    super(`Remote Engram "${cloudEngramId}" is missing SOUL.md or IDENTITY.md`);
    this.name = "MikoshiPullPersonaMissingError";
  }
}

// ---------------------------------------------------------------------------
// Usecase
// ---------------------------------------------------------------------------

export class MikoshiPull {
  constructor(
    private readonly localRepo: EngramRepository,
    private readonly mikoshi: MikoshiClient,
  ) {}

  /**
   * Phase 1: fetch + diff。上書きはまだしない。
   *
   * - ローカル未作成 → EngramNotFoundError
   * - ローカル既存 + 差分なし → already_synced
   * - ローカル既存 + 差分あり → apply で上書き
   */
  async check(engramId: string): Promise<{
    result: MikoshiPullResult;
    apply?: () => Promise<void>;
  }> {
    // 1. ローカル Engram 必須
    const local = await this.localRepo.get(engramId);
    if (!local) {
      throw new MikoshiPullEngramNotFoundError(engramId);
    }

    // 2. クラウド検索
    const cloudEngram = await this.mikoshi.getEngramBySourceId(engramId);
    if (!cloudEngram) throw new MikoshiPullCloudNotFoundError(engramId);

    // 3. Detail 取得 (persona content 込み)
    const detail = await this.mikoshi.getEngram(cloudEngram.id);
    const { soul: remoteSoul, identity: remoteIdentity } = extractPersona(detail);

    if (!remoteSoul || !remoteIdentity) {
      throw new MikoshiPullPersonaMissingError(cloudEngram.id);
    }

    // 4. 差分計算 (末尾空白の差異は無視)
    const soulDiffers = normalizeContent(local.files.soul) !== normalizeContent(remoteSoul);
    const identityDiffers = normalizeContent(local.files.identity) !== normalizeContent(remoteIdentity);

    if (!soulDiffers && !identityDiffers) {
      return {
        result: {
          outcome: "already_synced",
          engramId,
          engramName: local.meta.name,
          cloudEngramId: cloudEngram.id,
        },
      };
    }

    const diff: MikoshiPullDiff = {
      soulDiffers,
      identityDiffers,
      remoteSoul,
      remoteIdentity,
    };

    // 5. apply クロージャ
    const apply = async () => {
      const fresh = await this.localRepo.get(engramId);
      if (!fresh) throw new MikoshiPullEngramNotFoundError(engramId);

      const updatedFiles = { ...fresh.files };
      if (soulDiffers) updatedFiles.soul = remoteSoul;
      if (identityDiffers) updatedFiles.identity = remoteIdentity;

      await this.localRepo.save({
        meta: { ...fresh.meta, updatedAt: new Date().toISOString() },
        files: updatedFiles,
      });
    };

    return {
      result: {
        outcome: "pulled",
        engramId,
        engramName: local.meta.name,
        cloudEngramId: cloudEngram.id,
        diff,
      },
      apply,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractPersona(detail: MikoshiEngramDetail): {
  soul: string | undefined;
  identity: string | undefined;
} {
  let soul: string | undefined;
  let identity: string | undefined;
  for (const f of detail.personaFiles) {
    if (f.fileType === "SOUL") soul = f.content;
    if (f.fileType === "IDENTITY") identity = f.content;
  }
  return { soul, identity };
}

/** Trim trailing whitespace so minor formatting differences don't cause false diffs. */
function normalizeContent(content: string | undefined): string {
  return (content ?? "").trimEnd();
}
