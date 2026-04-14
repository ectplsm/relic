import { existsSync } from "node:fs";
import type { EngramRepository } from "../ports/engram-repository.js";
import type { MikoshiClient, MikoshiEngramDetail } from "../ports/mikoshi.js";
import {
  parseAvatarRef,
  resolveAvatarPath,
  rewriteAvatarValue,
} from "../sync/avatar.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MikoshiPullOutcome = "pulled" | "already_synced";

export interface MikoshiPullDiff {
  soulDiffers: boolean;
  identityDiffers: boolean;
  remoteSoul: string;
  /**
   * 書き込み対象の IDENTITY.md。
   *
   * リモート IDENTITY.md の Avatar 行を
   * `avatarUrl` に書き換えた後の最終形で保持する。
   * 書き換えが発生しなかった場合は remote 原文と同一。
   */
  remoteIdentity: string;
  /**
   * Avatar 行を Mikoshi 上の URL に書き換えたかどうか。
   *
   * 書き換えが発生したときのみ URL 文字列がセットされ、
   * CLI が書き換え結果をユーザーへ通知するのに使う。
   */
  rewrittenAvatarUrl?: string;
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

    // Avatar URL fallback (Phase 3):
    // ローカルに有効な avatar 画像があれば remote IDENTITY をそのまま採用。
    // ローカル画像が無い / ローカル値が URL の場合で remote.avatarUrl があれば
    // apply 対象の IDENTITY を URL 版に差し替える。Avatar 行自体が無ければ
    // rewriteAvatarValue は no-op なので何も追加しない。
    const engramDir = this.localRepo.getEngramPath(engramId);
    const appliedIdentity = this.resolveAppliedIdentity({
      remoteIdentity,
      remoteAvatarUrl: detail.avatarUrl,
      localIdentity: local.files.identity,
      engramDir,
    });

    const rewrittenAvatarUrl =
      detail.avatarUrl && appliedIdentity !== remoteIdentity
        ? detail.avatarUrl
        : undefined;

    // 4. 差分計算 (末尾空白の差異は無視)
    const soulDiffers = normalizeContent(local.files.soul) !== normalizeContent(remoteSoul);
    const identityDiffers = normalizeContent(local.files.identity) !== normalizeContent(appliedIdentity);

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
      remoteIdentity: appliedIdentity,
      rewrittenAvatarUrl,
    };

    // 5. apply クロージャ
    const apply = async () => {
      const fresh = await this.localRepo.get(engramId);
      if (!fresh) throw new MikoshiPullEngramNotFoundError(engramId);

      const updatedFiles = { ...fresh.files };
      if (soulDiffers) updatedFiles.soul = remoteSoul;
      if (identityDiffers) updatedFiles.identity = appliedIdentity;

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

  /**
   * apply 対象となる IDENTITY.md を決定する。
   *
   * - リモートに `avatarUrl` が無い → remote をそのまま
   * - ローカルに Avatar 行の path があり、そのファイルが存在する
   *   → ローカル画像が source of truth なので remote (path) を採用
   * - それ以外（ローカル画像なし / ローカル値が URL / path だけあるがファイル欠如）
   *   → remote IDENTITY の Avatar 行を R2 URL に書き換え
   *
   * Avatar 行自体が無ければ rewrite は no-op で remote と等価になる。
   */
  private resolveAppliedIdentity(args: {
    remoteIdentity: string;
    remoteAvatarUrl: string | null;
    localIdentity: string | undefined;
    engramDir: string | null;
  }): string {
    const { remoteIdentity, remoteAvatarUrl, localIdentity, engramDir } = args;
    if (!remoteAvatarUrl) return remoteIdentity;

    if (localIdentity && engramDir) {
      const localRef = parseAvatarRef(localIdentity);
      if (localRef?.kind === "path") {
        const resolved = resolveAvatarPath(localRef.value, engramDir);
        if (existsSync(resolved)) {
          return remoteIdentity;
        }
      }
    }

    return rewriteAvatarValue(remoteIdentity, remoteAvatarUrl);
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
