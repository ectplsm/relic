import type { EngramRepository } from "../ports/engram-repository.js";
import type { MikoshiClient, MikoshiEngramDetail } from "../ports/mikoshi.js";
import { rewriteAvatarValue } from "../sync/avatar.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MikoshiDownloadResult {
  engramId: string;
  engramName: string;
  cloudEngramId: string;
  /**
   * リモートに `avatarUrl` があり、ローカルに書き込んだ IDENTITY.md の
   * Avatar 行をその URL で書き換えた場合にセットされる。
   */
  rewrittenAvatarUrl?: string;
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

    // Avatar URL fallback (Phase 3):
    // リモートに avatarUrl があれば、IDENTITY.md の Avatar 行をその URL に
    // 書き換えてから保存する。新規ダウンロード時はローカルに画像が無いので
    // URL 版のほうが Construct / Shell で表示できて実用的。
    // Avatar 行が無ければ rewriteAvatarValue は no-op なので何も起こらない。
    let identityToWrite = identity;
    let rewrittenAvatarUrl: string | undefined;
    if (detail.avatarUrl) {
      const next = rewriteAvatarValue(identity, detail.avatarUrl);
      if (next !== identity) {
        identityToWrite = next;
        rewrittenAvatarUrl = detail.avatarUrl;
      }
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
        identity: identityToWrite,
      },
    });

    return {
      engramId,
      engramName: detail.name,
      cloudEngramId: cloudEngram.id,
      rewrittenAvatarUrl,
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
