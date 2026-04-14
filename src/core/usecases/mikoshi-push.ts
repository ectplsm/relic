import type { EngramRepository } from "../ports/engram-repository.js";
import type { MikoshiClient } from "../ports/mikoshi.js";
import { MikoshiApiError } from "../ports/mikoshi.js";
import { computePersonaHash } from "../sync/persona-hash.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MikoshiPushOutcome = "create_required" | "push_required" | "already_synced";

/**
 * Avatar 差分判定の結果。
 *
 * - `no_avatar_field`     : IDENTITY.md に Avatar フィールドが無い、または URL 値
 * - `no_local_file`       : Avatar フィールドはあるがローカルにファイルが無い（削除は自動化しない）
 * - `skip`                : ローカルハッシュがリモート (manifest) と一致
 * - `upload_required`     : 初回 or ハッシュ不一致。アップロード候補
 */
export type MikoshiPushAvatarOutcome =
  | "no_avatar_field"
  | "no_local_file"
  | "skip"
  | "upload_required";

export interface MikoshiPushAvatarInfo {
  outcome: MikoshiPushAvatarOutcome;
  /** 解決済みの絶対パス (outcome が no_avatar_field 以外で設定) */
  localPath?: string;
  /** IDENTITY.md に書かれていた生のパス値 */
  rawPath?: string;
  /** `sha256:<hex>` 形式。outcome が "skip" / "upload_required" のときのみ設定 */
  localHash?: string;
  /** バリデーション済み MIME。upload_required のときのみ設定 */
  localMimeType?: string;
  /** ファイルサイズ (bytes)。upload_required のときのみ設定 */
  localSize?: number;
}

export interface MikoshiPushResult {
  outcome: MikoshiPushOutcome;
  engramId: string;
  engramName: string;
  /** クラウド側の canonical ID (existing remote only) */
  cloudEngramId?: string;
  remotePersonaHash?: string | null;
  /** Avatar 差分情報 (check 時点のスナップショット) */
  avatar?: MikoshiPushAvatarInfo;
}

export type MikoshiPushAvatarAction =
  | "uploaded"
  | "skipped"
  | "not_applicable";

export interface MikoshiPushApplyResult {
  action: "created" | "updated";
  cloudEngramId: string;
  newPersonaHash?: string;
  /** Avatar アップロードの結果 */
  avatarAction?: MikoshiPushAvatarAction;
  /** アップロード成功時のみ設定される R2 上の URL */
  newAvatarUrl?: string;
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

export class MikoshiPushAvatarReadError extends Error {
  constructor(
    public readonly engramId: string,
    public readonly avatarPath: string,
    public readonly cause?: unknown,
  ) {
    super(`Failed to read avatar file for "${engramId}": ${avatarPath}`);
    this.name = "MikoshiPushAvatarReadError";
  }
}

export class MikoshiPushAvatarTooLargeError extends Error {
  constructor(
    public readonly engramId: string,
    public readonly avatarPath: string,
    public readonly actualBytes: number,
    public readonly maxBytes: number,
  ) {
    super(
      `Avatar for "${engramId}" is ${actualBytes} bytes, exceeds limit of ${maxBytes} bytes`,
    );
    this.name = "MikoshiPushAvatarTooLargeError";
  }
}

export class MikoshiPushAvatarInvalidMimeError extends Error {
  constructor(
    public readonly engramId: string,
    public readonly avatarPath: string,
  ) {
    super(
      `Avatar for "${engramId}" has unsupported format: ${avatarPath} (only JPEG, PNG, and WebP are allowed)`,
    );
    this.name = "MikoshiPushAvatarInvalidMimeError";
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
