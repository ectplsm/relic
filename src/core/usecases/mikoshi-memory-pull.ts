import type { EngramRepository } from "../ports/engram-repository.js";
import type { MikoshiClient } from "../ports/mikoshi.js";
import { decryptMemoryBundle, type DecryptedMemoryFiles } from "../sync/crypto.js";
import { collectMemoryFiles, memoryFilesToRecord } from "../sync/memory-hash.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MikoshiMemoryPullOutcome = "pulled" | "already_synced" | "no_remote_memory";

export interface MikoshiMemoryPullDiff {
  added: string[];
  changed: string[];
  removed: string[];
}

export interface MikoshiMemoryPullResult {
  outcome: MikoshiMemoryPullOutcome;
  engramId: string;
  engramName: string;
  cloudEngramId: string;
  diff?: MikoshiMemoryPullDiff;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MikoshiMemoryPullEngramNotFoundError extends Error {
  constructor(public readonly engramId: string) {
    super(`Engram "${engramId}" not found locally`);
    this.name = "MikoshiMemoryPullEngramNotFoundError";
  }
}

export class MikoshiMemoryPullCloudNotFoundError extends Error {
  constructor(public readonly sourceEngramId: string) {
    super(`Engram "${sourceEngramId}" not found on Mikoshi`);
    this.name = "MikoshiMemoryPullCloudNotFoundError";
  }
}

export class MikoshiMemoryPullDecryptError extends Error {
  constructor(cause?: unknown) {
    super("Failed to decrypt memory bundle — wrong passphrase or corrupted data");
    this.name = "MikoshiMemoryPullDecryptError";
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Usecase
// ---------------------------------------------------------------------------

export class MikoshiMemoryPull {
  constructor(
    private readonly localRepo: EngramRepository,
    private readonly mikoshi: MikoshiClient,
  ) {}

  /**
   * Phase 1: download + decrypt + diff。書き込みはまだしない。
   */
  async check(engramId: string, passphrase: string): Promise<{
    result: MikoshiMemoryPullResult;
    apply?: () => Promise<void>;
  }> {
    // 1. ローカル Engram
    const local = await this.localRepo.get(engramId);
    if (!local) throw new MikoshiMemoryPullEngramNotFoundError(engramId);

    // 2. クラウド検索
    const cloudEngram = await this.mikoshi.getEngramBySourceId(engramId);
    if (!cloudEngram) throw new MikoshiMemoryPullCloudNotFoundError(engramId);

    // 3. 暗号化バンドルをダウンロード
    const memoryRes = await this.mikoshi.downloadMemory(cloudEngram.id);

    if (!memoryRes.hasMemory) {
      return {
        result: {
          outcome: "no_remote_memory",
          engramId,
          engramName: local.meta.name,
          cloudEngramId: cloudEngram.id,
        },
      };
    }

    // 4. 復号
    let remoteFiles: DecryptedMemoryFiles;
    try {
      remoteFiles = decryptMemoryBundle(memoryRes, passphrase);
    } catch (err) {
      throw new MikoshiMemoryPullDecryptError(err);
    }

    // 5. ローカルとの差分計算
    const localEntries = collectMemoryFiles(local.files);
    const localRecord = memoryFilesToRecord(localEntries);
    const diff = computeDiff(localRecord, remoteFiles);

    if (diff.added.length === 0 && diff.changed.length === 0 && diff.removed.length === 0) {
      return {
        result: {
          outcome: "already_synced",
          engramId,
          engramName: local.meta.name,
          cloudEngramId: cloudEngram.id,
        },
      };
    }

    // 6. apply クロージャ
    const apply = async () => {
      const fresh = await this.localRepo.get(engramId);
      if (!fresh) throw new MikoshiMemoryPullEngramNotFoundError(engramId);

      const updatedFiles = { ...fresh.files };

      // リモートバンドルからファイルを適用
      updatedFiles.user = remoteFiles["USER.md"] ?? undefined;
      updatedFiles.memory = remoteFiles["MEMORY.md"] ?? undefined;

      // memory entries を再構築
      const newEntries: Record<string, string> = {};
      for (const [path, content] of Object.entries(remoteFiles)) {
        if (path.startsWith("memory/") && path.endsWith(".md")) {
          const date = path.replace("memory/", "").replace(".md", "");
          newEntries[date] = content;
        }
      }
      updatedFiles.memoryEntries = Object.keys(newEntries).length > 0 ? newEntries : undefined;

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

function computeDiff(
  local: Record<string, string>,
  remote: Record<string, string>,
): MikoshiMemoryPullDiff {
  const allPaths = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];

  for (const path of [...allPaths].sort()) {
    const inLocal = path in local;
    const inRemote = path in remote;
    if (inRemote && !inLocal) {
      added.push(path);
    } else if (inLocal && !inRemote) {
      removed.push(path);
    } else if (inLocal && inRemote && local[path] !== remote[path]) {
      changed.push(path);
    }
  }

  return { added, changed, removed };
}
