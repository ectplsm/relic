import type { EngramRepository } from "../ports/engram-repository.js";
import type { MikoshiClient, MikoshiEngramDetail } from "../ports/mikoshi.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MikoshiDownloadResult {
  engramId: string;
  engramName: string;
  cloudEngramId: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MikoshiDownloadAlreadyExistsError extends Error {
  constructor(public readonly engramId: string) {
    super(`Engram "${engramId}" already exists locally. Use "relic mikoshi pull" to update it.`);
    this.name = "MikoshiDownloadAlreadyExistsError";
  }
}

export class MikoshiDownloadCloudNotFoundError extends Error {
  constructor(public readonly sourceEngramId: string) {
    super(`Engram "${sourceEngramId}" not found on Mikoshi`);
    this.name = "MikoshiDownloadCloudNotFoundError";
  }
}

export class MikoshiDownloadPersonaMissingError extends Error {
  constructor(public readonly cloudEngramId: string) {
    super(`Remote Engram "${cloudEngramId}" is missing SOUL.md or IDENTITY.md`);
    this.name = "MikoshiDownloadPersonaMissingError";
  }
}

// ---------------------------------------------------------------------------
// Usecase
// ---------------------------------------------------------------------------

export class MikoshiDownload {
  constructor(
    private readonly localRepo: EngramRepository,
    private readonly mikoshi: MikoshiClient,
  ) {}

  /**
   * Download a remote Engram from Mikoshi to local.
   * Fails if the local Engram already exists.
   */
  async execute(engramId: string): Promise<MikoshiDownloadResult> {
    // 1. ローカルに既に存在 → エラー
    const existing = await this.localRepo.get(engramId);
    if (existing) {
      throw new MikoshiDownloadAlreadyExistsError(engramId);
    }

    // 2. クラウド検索
    const cloudEngram = await this.mikoshi.getEngramBySourceId(engramId);
    if (!cloudEngram) throw new MikoshiDownloadCloudNotFoundError(engramId);

    // 3. Detail 取得 (persona content 込み)
    const detail = await this.mikoshi.getEngram(cloudEngram.id);
    const { soul, identity } = extractPersona(detail);

    if (!soul || !identity) {
      throw new MikoshiDownloadPersonaMissingError(cloudEngram.id);
    }

    // 4. ローカルに新規作成
    const now = new Date().toISOString();
    await this.localRepo.save({
      meta: {
        id: engramId,
        name: detail.name,
        description: detail.description ?? undefined,
        tags: detail.tags,
        createdAt: now,
        updatedAt: now,
      },
      files: {
        soul,
        identity,
      },
    });

    return {
      engramId,
      engramName: detail.name,
      cloudEngramId: cloudEngram.id,
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
