import type { EngramRepository } from "../ports/engram-repository.js";
import type {
  MikoshiClient,
  SyncStatusResponse,
} from "../ports/mikoshi.js";
import { computePersonaHash } from "../sync/persona-hash.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PersonaDriftStatus = "synced" | "local_differs" | "remote_only" | "unavailable";
export type MemoryDriftStatus = "synced" | "local_differs" | "not_uploaded" | "unavailable";

export interface MikoshiStatusResult {
  engramId: string;
  engramName: string;
  /** Mikoshi 側の canonical ID */
  cloudEngramId: string;
  sourceEngramId: string;
  persona: {
    status: PersonaDriftStatus;
    localHash: string | null;
    remoteHash: string | null;
  };
  memory: {
    status: MemoryDriftStatus;
    remoteExists: boolean;
    remoteSummary: SyncStatusResponse["memory"]["summary"] | null;
  };
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class MikoshiStatusEngramNotFoundError extends Error {
  constructor(public readonly engramId: string) {
    super(`Engram "${engramId}" not found locally`);
    this.name = "MikoshiStatusEngramNotFoundError";
  }
}

export class MikoshiStatusCloudNotFoundError extends Error {
  constructor(public readonly sourceEngramId: string) {
    super(`Engram "${sourceEngramId}" not found on Mikoshi`);
    this.name = "MikoshiStatusCloudNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Usecase
// ---------------------------------------------------------------------------

export class MikoshiStatus {
  constructor(
    private readonly localRepo: EngramRepository,
    private readonly mikoshi: MikoshiClient,
  ) {}

  async execute(engramId: string): Promise<MikoshiStatusResult> {
    // 1. ローカル Engram 読み込み
    const local = await this.localRepo.get(engramId);
    if (!local) throw new MikoshiStatusEngramNotFoundError(engramId);

    // 2. クラウド側を sourceEngramId で検索
    const cloudEngram = await this.mikoshi.getEngramBySourceId(engramId);
    if (!cloudEngram) throw new MikoshiStatusCloudNotFoundError(engramId);

    // 3. sync-status 取得
    const syncStatus = await this.mikoshi.getSyncStatus(cloudEngram.id);

    // 4. ローカル persona hash 計算
    const localPersonaHash = computePersonaHash(
      local.files.soul,
      local.files.identity,
    );

    // 5. Persona drift 判定
    const remotePersonaHash = syncStatus.persona.token?.hash ?? null;
    const personaStatus = classifyPersonaDrift(localPersonaHash, remotePersonaHash);

    // 6. Memory drift 判定
    const memoryStatus = classifyMemoryDrift(syncStatus);

    return {
      engramId,
      engramName: local.meta.name,
      cloudEngramId: cloudEngram.id,
      sourceEngramId: cloudEngram.sourceEngramId,
      persona: {
        status: personaStatus,
        localHash: localPersonaHash,
        remoteHash: remotePersonaHash,
      },
      memory: {
        status: memoryStatus,
        remoteExists: syncStatus.memory.exists,
        remoteSummary: syncStatus.memory.summary,
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Drift classification helpers
// ---------------------------------------------------------------------------

function classifyPersonaDrift(
  localHash: string | null,
  remoteHash: string | null,
): PersonaDriftStatus {
  if (!localHash) return "unavailable";
  if (!remoteHash) return "remote_only";
  return localHash === remoteHash ? "synced" : "local_differs";
}

function classifyMemoryDrift(
  syncStatus: SyncStatusResponse,
): MemoryDriftStatus {
  if (!syncStatus.memory.exists) return "not_uploaded";
  // memory content hash 比較はクライアント暗号化の都合で
  // ローカル hash 計算が必要。初期版ではリモート有無だけ判定する。
  return "unavailable";
}
