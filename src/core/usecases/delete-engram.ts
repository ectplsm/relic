import type { Engram } from "../entities/engram.js";
import type { EngramRepository } from "../ports/engram-repository.js";

// ============================================================
// Errors
// ============================================================

export class DeleteEngramNotFoundError extends Error {
  constructor(id: string) {
    super(`Engram "${id}" not found.`);
    this.name = "DeleteEngramNotFoundError";
  }
}

// ============================================================
// Result
// ============================================================

export interface DeleteEngramInfo {
  engram: Engram;
  hasMemory: boolean;
  hasUser: boolean;
  hasArchive: boolean;
  memoryEntryCount: number;
}

// ============================================================
// Usecase
// ============================================================

export class DeleteEngram {
  constructor(private readonly repository: EngramRepository) {}

  /**
   * Inspect an Engram before deletion — returns info for confirmation UI.
   */
  async inspect(id: string): Promise<DeleteEngramInfo> {
    const engram = await this.repository.get(id);
    if (!engram) {
      throw new DeleteEngramNotFoundError(id);
    }

    return {
      engram,
      hasMemory: !!engram.files.memory,
      hasUser: !!engram.files.user,
      hasArchive: false, // archive.md is not loaded via EngramFiles; CLI checks separately
      memoryEntryCount: engram.files.memoryEntries
        ? Object.keys(engram.files.memoryEntries).length
        : 0,
    };
  }

  /**
   * Actually delete the Engram. Call inspect() first for confirmation.
   */
  async execute(id: string): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing) {
      throw new DeleteEngramNotFoundError(id);
    }
    await this.repository.delete(id);
  }
}
