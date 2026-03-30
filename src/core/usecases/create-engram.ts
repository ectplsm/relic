import type { Engram } from "../entities/engram.js";
import type { EngramRepository } from "../ports/engram-repository.js";

// ============================================================
// Errors
// ============================================================

export class EngramAlreadyExistsError extends Error {
  constructor(id: string) {
    super(`Engram "${id}" already exists. Delete it first or choose a different ID.`);
    this.name = "EngramAlreadyExistsError";
  }
}

export class InvalidEngramIdError extends Error {
  constructor(id: string) {
    super(
      `Invalid Engram ID "${id}". Use lowercase letters, numbers, and hyphens only (e.g. "my-agent").`
    );
    this.name = "InvalidEngramIdError";
  }
}

// ============================================================
// Params & Result
// ============================================================

export interface CreateEngramParams {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  soul: string;
  identity: string;
}

export interface CreateEngramResult {
  engram: Engram;
}

// ============================================================
// Usecase
// ============================================================

/** ID format: lowercase alphanumeric + hyphens, no leading/trailing hyphen */
export const ENGRAM_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class CreateEngram {
  constructor(private readonly repository: EngramRepository) {}

  async execute(params: CreateEngramParams): Promise<CreateEngramResult> {
    // Validate ID format
    if (!ENGRAM_ID_PATTERN.test(params.id)) {
      throw new InvalidEngramIdError(params.id);
    }

    // Check for duplicates
    const existing = await this.repository.get(params.id);
    if (existing) {
      throw new EngramAlreadyExistsError(params.id);
    }

    const now = new Date().toISOString();

    const engram: Engram = {
      meta: {
        id: params.id,
        name: params.name,
        description: params.description,
        tags: params.tags,
        createdAt: now,
        updatedAt: now,
      },
      files: {
        soul: params.soul,
        identity: params.identity,
      },
    };

    await this.repository.save(engram);

    return { engram };
  }
}
