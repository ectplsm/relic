import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { EngramMeta } from "../entities/engram.js";
import type { EngramRepository } from "../ports/engram-repository.js";
import type {
  MikoshiClient,
  MikoshiEngramDetail,
} from "../ports/mikoshi.js";
import { MikoshiApiError, AVATAR_MAX_BYTES } from "../ports/mikoshi.js";
import { computePersonaHash } from "../sync/persona-hash.js";
import {
  computeAvatarHash,
  computeAvatarHashFromBytes,
  detectAvatarMimeType,
  isAvatarOnlyDrift,
  fetchAvatarFromUrl,
  parseAvatarRef,
  resolveAvatarPath,
} from "../sync/avatar.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MikoshiPushOutcome = "create_required" | "push_required" | "already_synced";

/**
 * Avatar 差分判定の結果。
 *
 * - `no_avatar_field`     : IDENTITY.md に Avatar フィールドが無い
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
  source?: "file" | "url";
  /** 解決済みの絶対パス (outcome が no_avatar_field 以外で設定) */
  localPath?: string;
  /** IDENTITY.md に書かれていた生のパス値 */
  rawPath?: string;
  /** IDENTITY.md に書かれていた外部 URL */
  sourceUrl?: string;
  /** `sha256:<hex>` 形式。outcome が "skip" / "upload_required" のときのみ設定 */
  localHash?: string;
  /** バリデーション済み MIME。upload_required のときのみ設定 */
  localMimeType?: string;
  /** ファイルサイズ (bytes)。upload_required のときのみ設定 */
  localSize?: number;
}

/**
 * persona hash が不一致で、かつ local と remote の IDENTITY.md の差分が
 * Avatar 行の値だけだった場合にセットされる。
 *
 * pull 側で R2 URL にローカルを書き換えたときに自然に発生するケース。
 * CLI はこの値を使って「これは Avatar URL の drift ですよ」という
 * 専用メッセージを出してから push 承認を取り直す。
 */
export interface MikoshiPushAvatarDrift {
  localValue: string;
  remoteValue: string;
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
  /** push_required のとき、IDENTITY.md の diff が Avatar 行だけなら設定 */
  avatarDrift?: MikoshiPushAvatarDrift;
}

export type MikoshiPushAvatarAction = "uploaded" | "skipped" | "failed";

export interface MikoshiPushApplyResult {
  /**
   * - `created`     : 新規 Engram を作成した（avatar は同じ apply 内で追随）
   * - `updated`     : persona を上書きした
   * - `avatar_only` : persona は同期済みだが avatar だけ更新した
   */
  action: "created" | "updated" | "avatar_only";
  cloudEngramId: string;
  /** persona を更新したケースのみ設定 */
  newPersonaHash?: string;
  /** Avatar アップロードの結果 */
  avatarAction?: MikoshiPushAvatarAction;
  /** アップロード成功時のみ設定される R2 上の URL */
  newAvatarUrl?: string;
  /** `avatarAction === "failed"` の場合に設定される失敗原因 */
  avatarError?: Error;
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

export class MikoshiPushAvatarHttpError extends Error {
  constructor(
    public readonly engramId: string,
    public readonly avatarUrl: string,
  ) {
    super(`Avatar URL for "${engramId}" must use HTTPS: ${avatarUrl}`);
    this.name = "MikoshiPushAvatarHttpError";
  }
}

export class MikoshiPushAvatarPrivateHostError extends Error {
  constructor(
    public readonly engramId: string,
    public readonly avatarUrl: string,
  ) {
    super(`Avatar URL for "${engramId}" points to a private host: ${avatarUrl}`);
    this.name = "MikoshiPushAvatarPrivateHostError";
  }
}

export class MikoshiPushAvatarFetchError extends Error {
  constructor(
    public readonly engramId: string,
    public readonly avatarUrl: string,
    public readonly cause?: unknown,
  ) {
    super(`Failed to fetch avatar URL for "${engramId}": ${avatarUrl}`);
    this.name = "MikoshiPushAvatarFetchError";
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

    const engramDir = this.localRepo.getEngramPath(engramId);
    const cloudEngram = await this.mikoshi.getEngramBySourceId(engramId);
    const remoteAvatarUrl = cloudEngram?.avatarUrl ?? null;

    // 差分検出は localHash だけでなくリモートの avatarUrl 有無も見る。
    // - リモートに avatar がある → manifest ハッシュと比較 (従来挙動)
    // - リモートに avatar が無い / リモート Engram 自体無し → manifest に関係なく upload_required
    //   (Mikoshi エンドポイントを切り替えた場合に skip で詰まるのを防ぐ)
    const avatarInfo = engramDir
      ? await this.inspectAvatar(
          identity,
          engramDir,
          local.meta.avatarHash,
          local.meta.avatarSourceUrl,
          remoteAvatarUrl,
          engramId,
        )
      : { outcome: "no_avatar_field" as const };

    if (!cloudEngram) {
      return {
        result: {
          outcome: "create_required",
          engramId,
          engramName: local.meta.name,
          remotePersonaHash: null,
          avatar: avatarInfo,
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
          const avatarOutcome = await this.applyAvatarUpload(
            created.id,
            engramId,
            avatarInfo,
            local.meta,
          );
          return {
            action: "created",
            cloudEngramId: created.id,
            ...avatarOutcome,
          };
        },
      };
    }

    const syncStatus = await this.mikoshi.getSyncStatus(cloudEngram.id);
    const remoteHash = syncStatus.persona.token?.hash ?? null;

    if (remoteHash && localHash === remoteHash) {
      const apply =
        avatarInfo.outcome === "upload_required"
          ? async (): Promise<MikoshiPushApplyResult> => {
              const avatarOutcome = await this.applyAvatarUpload(
                cloudEngram.id,
                engramId,
                avatarInfo,
                local.meta,
              );
              return {
                action: "avatar_only",
                cloudEngramId: cloudEngram.id,
                ...avatarOutcome,
              };
            }
          : undefined;

      return {
        result: {
          outcome: "already_synced",
          engramId,
          engramName: local.meta.name,
          cloudEngramId: cloudEngram.id,
          remotePersonaHash: remoteHash,
          avatar: avatarInfo,
        },
        apply,
      };
    }

    // push_required の場合、local と remote の IDENTITY.md の差分が
    // Avatar 行だけかどうかをベストエフォートで調べる。
    // pull 側の URL 書き換えで自然に発生する drift を CLI が説明できるようにする。
    // detail 取得に失敗した場合は黙って諦めて通常の push フローに戻る。
    let avatarDrift: MikoshiPushAvatarDrift | undefined;
    try {
      const detail = await this.mikoshi.getEngram(cloudEngram.id);
      const remoteIdentity = extractRemoteIdentity(detail);
      if (remoteIdentity) {
        const drift = isAvatarOnlyDrift(identity, remoteIdentity);
        if (drift.drift && drift.localValue && drift.remoteValue) {
          avatarDrift = {
            localValue: drift.localValue,
            remoteValue: drift.remoteValue,
          };
        }
      }
    } catch {
      // best effort — detail fetch error は drift 警告を諦めるだけに留める
    }

    return {
      result: {
        outcome: "push_required",
        engramId,
        engramName: local.meta.name,
        cloudEngramId: cloudEngram.id,
        remotePersonaHash: remoteHash,
        avatar: avatarInfo,
        avatarDrift,
      },
      apply: async () => {
        const expectedHash = remoteHash ?? "";
        let newPersonaHash: string;
        try {
          const updated = await this.mikoshi.updatePersona(cloudEngram.id, {
            soul,
            identity,
            expectedRemotePersonaHash: expectedHash,
          });
          newPersonaHash = updated.persona.hash;
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

        const avatarOutcome = await this.applyAvatarUpload(
          cloudEngram.id,
          engramId,
          avatarInfo,
          local.meta,
        );

        return {
          action: "updated",
          cloudEngramId: cloudEngram.id,
          newPersonaHash,
          ...avatarOutcome,
        };
      },
    };
  }

  async execute(engramId: string): Promise<MikoshiPushApplyResult | undefined> {
    const { apply } = await this.check(engramId);
    if (!apply) return undefined;
    return apply();
  }

  /**
   * IDENTITY.md の Avatar フィールドを解析し、ローカルファイルを検査して
   * 差分情報を返す。
   *
   * 判定順:
   * - Avatar フィールドなし → `no_avatar_field`
   * - URL 値で、remote.avatarUrl と一致 or manifest の source URL と一致 → `skip`
   * - URL 値で、それ以外 → `upload_required`
   * - フィールドありだがファイル不在 → `no_local_file`（削除は自動化しない）
   * - リモートに avatarUrl が **あり** かつ manifest ハッシュと一致 → `skip`
   * - リモートに avatarUrl が **無い**、または ハッシュ不一致 → `upload_required`
   *
   * リモート側の avatarUrl が無ければ manifest ハッシュの一致は意味を持たない。
   * これは Mikoshi エンドポイント切り替えや、リモート側で手動削除された
   * ケースで skip で詰まるのを防ぐため。
   *
   * MIME 非対応 / サイズ超過 / 読み取り失敗はエラーとして throw する。
   */
  private async inspectAvatar(
    identity: string | undefined,
    engramDir: string,
    existingHash: string | undefined,
    existingSourceUrl: string | undefined,
    remoteAvatarUrl: string | null,
    engramId: string,
  ): Promise<MikoshiPushAvatarInfo> {
    if (!identity) return { outcome: "no_avatar_field" };

    const avatarRef = parseAvatarRef(identity);
    if (!avatarRef) return { outcome: "no_avatar_field" };

    if (avatarRef.kind === "url") {
      if (remoteAvatarUrl && avatarRef.value === remoteAvatarUrl) {
        return {
          outcome: "skip",
          source: "url",
          sourceUrl: avatarRef.value,
        };
      }

      if (existingSourceUrl && avatarRef.value === existingSourceUrl) {
        return {
          outcome: "skip",
          source: "url",
          sourceUrl: avatarRef.value,
          localHash: existingHash,
        };
      }

      return {
        outcome: "upload_required",
        source: "url",
        sourceUrl: avatarRef.value,
      };
    }

    const rawPath = avatarRef.value;

    const localPath = resolveAvatarPath(rawPath, engramDir);

    if (!existsSync(localPath)) {
      return { outcome: "no_local_file", source: "file", rawPath, localPath };
    }

    const mimeType = detectAvatarMimeType(localPath);
    if (!mimeType) {
      throw new MikoshiPushAvatarInvalidMimeError(engramId, localPath);
    }

    let size: number;
    try {
      const stats = await stat(localPath);
      size = stats.size;
    } catch (err) {
      throw new MikoshiPushAvatarReadError(engramId, localPath, err);
    }

    if (size > AVATAR_MAX_BYTES) {
      throw new MikoshiPushAvatarTooLargeError(
        engramId,
        localPath,
        size,
        AVATAR_MAX_BYTES,
      );
    }

    let localHash: string;
    try {
      localHash = await computeAvatarHash(localPath);
    } catch (err) {
      throw new MikoshiPushAvatarReadError(engramId, localPath, err);
    }

    const remoteHasAvatar = remoteAvatarUrl !== null && remoteAvatarUrl !== "";
    if (remoteHasAvatar && existingHash && localHash === existingHash) {
      return { outcome: "skip", source: "file", rawPath, localPath, localHash };
    }

    return {
      outcome: "upload_required",
      source: "file",
      rawPath,
      localPath,
      localHash,
      localMimeType: mimeType,
      localSize: size,
    };
  }

  /**
   * 必要なら avatar をアップロードし、成功時に manifest を更新する。
   *
   * - `upload_required` 以外 → `avatarAction: "skipped"` で即返す
   * - upload に失敗しても persona の成功は巻き戻さず、
   *   `avatarAction: "failed"` と `avatarError` で呼び出し側に知らせる
   */
  private async applyAvatarUpload(
    cloudEngramId: string,
    engramId: string,
    info: MikoshiPushAvatarInfo,
    meta: EngramMeta,
  ): Promise<
    Pick<
      MikoshiPushApplyResult,
      "avatarAction" | "newAvatarUrl" | "avatarError"
    >
  > {
    if (info.outcome !== "upload_required") {
      return { avatarAction: "skipped" };
    }

    try {
      let bytes: Buffer;
      let mimeType: string;
      let avatarHash: string;
      let avatarSourceUrl: string | undefined;

      if (info.source === "url") {
        if (!info.sourceUrl) {
          return { avatarAction: "skipped" };
        }

        try {
          const fetched = await fetchAvatarFromUrl(
            info.sourceUrl,
            AVATAR_MAX_BYTES,
            10_000,
          );
          bytes = fetched.bytes;
          mimeType = fetched.mimeType;
          avatarHash = computeAvatarHashFromBytes(bytes);
          avatarSourceUrl = info.sourceUrl;
        } catch (err) {
          if (err instanceof Error) {
            const message = err.message.toLowerCase();
            if (message.includes("must use https")) {
              throw new MikoshiPushAvatarHttpError(engramId, info.sourceUrl);
            }
            if (message.includes("private host")) {
              throw new MikoshiPushAvatarPrivateHostError(engramId, info.sourceUrl);
            }
          }
          throw new MikoshiPushAvatarFetchError(engramId, info.sourceUrl, err);
        }
      } else {
        if (!info.localPath || !info.localMimeType || !info.localHash) {
          // 型上はありうるが、check() 側の upload_required は常にこれらを満たす
          return { avatarAction: "skipped" };
        }
        bytes = await readFile(info.localPath);
        mimeType = info.localMimeType;
        avatarHash = info.localHash;
      }

      const response = await this.mikoshi.uploadEngramAvatar(
        cloudEngramId,
        bytes,
        mimeType,
      );

      // manifest の avatarHash を更新。updatedAt も合わせて進める。
      await this.localRepo.updateManifest(engramId, {
        id: meta.id,
        createdAt: meta.createdAt,
        updatedAt: new Date().toISOString(),
        avatarHash,
        avatarSourceUrl,
      });

      return {
        avatarAction: "uploaded",
        newAvatarUrl: response.avatarUrl,
      };
    } catch (err) {
      return {
        avatarAction: "failed",
        avatarError: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractRemoteIdentity(detail: MikoshiEngramDetail): string | undefined {
  for (const file of detail.personaFiles) {
    if (file.fileType === "IDENTITY") return file.content;
  }
  return undefined;
}
