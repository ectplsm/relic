import type { EngramRepository } from "../ports/engram-repository.js";
import type { MikoshiClient } from "../ports/mikoshi.js";
import { MikoshiApiError } from "../ports/mikoshi.js";
import { decryptMemoryBundle, encryptMemoryBundle } from "../sync/crypto.js";
import { collectMemoryFiles, computeMemoryContentHash, memoryFilesToRecord } from "../sync/memory-hash.js";
import {
  applyMemoryRecordToFiles,
  computeMemoryRecordDiff,
  mergeMemoryRecords,
  type MemoryRecordDiff,
} from "../sync/memory-merge.js";

export type MikoshiMemorySyncOutcome = "synced" | "already_synced" | "conflict";

export interface MikoshiMemorySyncResult {
  outcome: MikoshiMemorySyncOutcome;
  engramId: string;
  engramName: string;
  cloudEngramId: string;
  localUpdated?: boolean;
  remoteUpdated?: boolean;
  diff?: MemoryRecordDiff;
  mergedPaths?: string[];
  version?: number;
  memoryContentHash?: string;
  bundleHash?: string;
  conflictRemoteHash?: string;
  conflictRemoteVersion?: number;
}

export class MikoshiMemorySyncEngramNotFoundError extends Error {
  constructor(public readonly engramId: string) {
    super(`Engram "${engramId}" not found locally`);
    this.name = "MikoshiMemorySyncEngramNotFoundError";
  }
}

export class MikoshiMemorySyncCloudNotFoundError extends Error {
  constructor(public readonly sourceEngramId: string) {
    super(`Engram "${sourceEngramId}" not found on Mikoshi. Push persona first with: relic mikoshi push`);
    this.name = "MikoshiMemorySyncCloudNotFoundError";
  }
}

export class MikoshiMemorySyncDecryptError extends Error {
  constructor(cause?: unknown) {
    super("Failed to decrypt memory bundle — wrong passphrase or corrupted data");
    this.name = "MikoshiMemorySyncDecryptError";
    this.cause = cause;
  }
}

export class MikoshiMemorySync {
  constructor(
    private readonly localRepo: EngramRepository,
    private readonly mikoshi: MikoshiClient,
  ) {}

  async execute(engramId: string, passphrase: string): Promise<MikoshiMemorySyncResult> {
    const local = await this.localRepo.get(engramId);
    if (!local) throw new MikoshiMemorySyncEngramNotFoundError(engramId);

    const cloudEngram = await this.mikoshi.getEngramBySourceId(engramId);
    if (!cloudEngram) throw new MikoshiMemorySyncCloudNotFoundError(engramId);

    const localRecord = memoryFilesToRecord(collectMemoryFiles(local.files));
    const memoryRes = await this.mikoshi.downloadMemory(cloudEngram.id);

    let remoteRecord: Record<string, string> = {};
    let expectedRemoteHash: string | null = null;

    if (memoryRes.hasMemory) {
      try {
        remoteRecord = decryptMemoryBundle(memoryRes, passphrase);
      } catch (err) {
        throw new MikoshiMemorySyncDecryptError(err);
      }
      expectedRemoteHash = memoryRes.memoryContentHash;
    }

    if (Object.keys(localRecord).length === 0 && Object.keys(remoteRecord).length === 0) {
      return {
        outcome: "already_synced",
        engramId,
        engramName: local.meta.name,
        cloudEngramId: cloudEngram.id,
        localUpdated: false,
        remoteUpdated: false,
      };
    }

    const diff = computeMemoryRecordDiff(localRecord, remoteRecord);
    const { merged, changedPaths } = mergeMemoryRecords(localRecord, remoteRecord);
    const localUpdated = !recordsEqual(localRecord, merged);
    const remoteUpdated = !recordsEqual(remoteRecord, merged);

    if (!localUpdated && !remoteUpdated) {
      return {
        outcome: "already_synced",
        engramId,
        engramName: local.meta.name,
        cloudEngramId: cloudEngram.id,
        localUpdated: false,
        remoteUpdated: false,
        diff,
        mergedPaths: [],
      };
    }

    if (localUpdated) {
      await this.localRepo.save({
        meta: { ...local.meta, updatedAt: new Date().toISOString() },
        files: applyMemoryRecordToFiles(local.files, merged),
      });
    }

    if (!remoteUpdated) {
      return {
        outcome: "synced",
        engramId,
        engramName: local.meta.name,
        cloudEngramId: cloudEngram.id,
        localUpdated,
        remoteUpdated: false,
        diff,
        mergedPaths: changedPaths,
      };
    }

    const mergedBundle = encryptMemoryBundle(merged, passphrase);
    const mergedEntries = Object.entries(merged).map(([path, content]) => ({ path, content }));
    const memoryContentHash = computeMemoryContentHash(mergedEntries);
    if (!memoryContentHash) {
      return {
        outcome: "already_synced",
        engramId,
        engramName: local.meta.name,
        cloudEngramId: cloudEngram.id,
        localUpdated,
        remoteUpdated: false,
        diff,
        mergedPaths: changedPaths,
      };
    }

    try {
      const uploaded = await this.mikoshi.uploadMemory(cloudEngram.id, {
        ciphertext: mergedBundle.ciphertext,
        cipherAlgorithm: mergedBundle.cipherAlgorithm,
        cipherNonce: mergedBundle.cipherNonce,
        wrappedBundleKey: mergedBundle.wrappedBundleKey,
        wrapAlgorithm: mergedBundle.wrapAlgorithm,
        kdfAlgorithm: mergedBundle.kdfAlgorithm,
        kdfSalt: mergedBundle.kdfSalt,
        kdfParams: mergedBundle.kdfParams,
        manifest: mergedBundle.manifest,
        expectedRemoteMemoryContentHash: expectedRemoteHash,
        memoryContentHash,
        bundleHash: mergedBundle.bundleHash,
      });

      return {
        outcome: "synced",
        engramId,
        engramName: local.meta.name,
        cloudEngramId: cloudEngram.id,
        localUpdated,
        remoteUpdated: true,
        diff,
        mergedPaths: changedPaths,
        version: uploaded.version,
        memoryContentHash: uploaded.memoryContentHash,
        bundleHash: uploaded.bundleHash,
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
          localUpdated,
          remoteUpdated: true,
          diff,
          mergedPaths: changedPaths,
          conflictRemoteHash: body?.currentMemory?.memoryContentHash,
          conflictRemoteVersion: body?.currentMemory?.version,
        };
      }
      throw err;
    }
  }
}

function recordsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i += 1) {
    if (aKeys[i] !== bKeys[i]) return false;
    if (a[aKeys[i]] !== b[bKeys[i]]) return false;
  }
  return true;
}
