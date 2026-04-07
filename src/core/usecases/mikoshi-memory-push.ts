import type { EngramRepository } from "../ports/engram-repository.js";
import type { MikoshiClient } from "../ports/mikoshi.js";
import { MikoshiApiError } from "../ports/mikoshi.js";
import { collectMemoryFiles, memoryFilesToRecord, computeMemoryContentHash } from "../sync/memory-hash.js";
import { encryptMemoryBundle } from "../sync/crypto.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MikoshiMemoryPushOutcome = "uploaded" | "conflict";

export interface MikoshiMemoryPushResult {
  outcome: MikoshiMemoryPushOutcome;
  engramId: string;
  engramName: string;
  cloudEngramId: string;
  /** upload 成功時 */
  version?: number;
  memoryContentHash?: string;
  bundleHash?: string;
  /** conflict 時のリモート情報 */
  conflictRemoteHash?: string;
  conflictRemoteVersion?: number;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MikoshiMemoryPushEngramNotFoundError extends Error {
  constructor(public readonly engramId: string) {
    super(`Engram "${engramId}" not found locally`);
    this.name = "MikoshiMemoryPushEngramNotFoundError";
  }
}

export class MikoshiMemoryPushNoFilesError extends Error {
  constructor(public readonly engramId: string) {
    super(`Engram "${engramId}" has no memory files to upload`);
    this.name = "MikoshiMemoryPushNoFilesError";
  }
}

export class MikoshiMemoryPushCloudNotFoundError extends Error {
  constructor(public readonly sourceEngramId: string) {
    super(`Engram "${sourceEngramId}" not found on Mikoshi. Push persona first with: relic mikoshi push`);
    this.name = "MikoshiMemoryPushCloudNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Usecase
// ---------------------------------------------------------------------------

export class MikoshiMemoryPush {
  constructor(
    private readonly localRepo: EngramRepository,
    private readonly mikoshi: MikoshiClient,
  ) {}

  async execute(engramId: string, passphrase: string): Promise<MikoshiMemoryPushResult> {
    // 1. ローカル Engram 読み込み
    const local = await this.localRepo.get(engramId);
    if (!local) throw new MikoshiMemoryPushEngramNotFoundError(engramId);

    // 2. Memory ファイル収集
    const memoryEntries = collectMemoryFiles(local.files);
    if (memoryEntries.length === 0) throw new MikoshiMemoryPushNoFilesError(engramId);

    // 3. クラウド検索
    const cloudEngram = await this.mikoshi.getEngramBySourceId(engramId);
    if (!cloudEngram) throw new MikoshiMemoryPushCloudNotFoundError(engramId);

    // 4. 暗号化
    const filesRecord = memoryFilesToRecord(memoryEntries);
    const bundle = encryptMemoryBundle(filesRecord, passphrase);

    // 5. ローカル memory content hash
    const memoryContentHash = computeMemoryContentHash(memoryEntries);
    if (!memoryContentHash) throw new MikoshiMemoryPushNoFilesError(engramId);

    // 6. リモートの現在の memory hash を取得
    const syncStatus = await this.mikoshi.getSyncStatus(cloudEngram.id);
    const expectedRemoteHash = syncStatus.memory.token?.memoryContentHash ?? null;

    // 7. アップロード
    try {
      const res = await this.mikoshi.uploadMemory(cloudEngram.id, {
        ciphertext: bundle.ciphertext,
        cipherAlgorithm: bundle.cipherAlgorithm,
        cipherNonce: bundle.cipherNonce,
        wrappedBundleKey: bundle.wrappedBundleKey,
        wrapAlgorithm: bundle.wrapAlgorithm,
        kdfAlgorithm: bundle.kdfAlgorithm,
        kdfSalt: bundle.kdfSalt,
        kdfParams: bundle.kdfParams,
        manifest: bundle.manifest,
        expectedRemoteMemoryContentHash: expectedRemoteHash,
        memoryContentHash,
        bundleHash: bundle.bundleHash,
      });

      return {
        outcome: "uploaded",
        engramId,
        engramName: local.meta.name,
        cloudEngramId: cloudEngram.id,
        version: res.version,
        memoryContentHash: res.memoryContentHash,
        bundleHash: res.bundleHash,
      };
    } catch (err) {
      if (err instanceof MikoshiApiError && err.isConflict && err.code === "MEMORY_CONFLICT") {
        const body = err.body as {
          currentMemory?: { memoryContentHash?: string; version?: number };
        } | undefined;
        return {
          outcome: "conflict",
          engramId,
          engramName: local.meta.name,
          cloudEngramId: cloudEngram.id,
          conflictRemoteHash: body?.currentMemory?.memoryContentHash,
          conflictRemoteVersion: body?.currentMemory?.version,
        };
      }
      throw err;
    }
  }
}
