import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { EngramRepository } from "../ports/engram-repository.js";

export interface MigrateEngramsResult {
  migrated: string[];
  alreadyUpToDate: string[];
  skipped: Array<{ id: string; reason: string }>;
}

/**
 * MigrateEngrams — 既存Engramを走査し、新形式の manifest.json へ前倒し移行する
 */
export class MigrateEngrams {
  constructor(
    private readonly repository: EngramRepository,
    private readonly basePath: string
  ) {}

  async execute(): Promise<MigrateEngramsResult> {
    if (!existsSync(this.basePath)) {
      return { migrated: [], alreadyUpToDate: [], skipped: [] };
    }

    const entries = await readdir(this.basePath, { withFileTypes: true });
    const dirs = entries.filter((entry) => entry.isDirectory());

    const result: MigrateEngramsResult = {
      migrated: [],
      alreadyUpToDate: [],
      skipped: [],
    };

    for (const dir of dirs) {
      const id = dir.name;
      const engramDir = join(this.basePath, id);
      const profilePath = join(engramDir, "engram.json");
      const manifestPath = join(engramDir, "manifest.json");

      if (!existsSync(profilePath)) {
        result.skipped.push({ id, reason: "engram.json not found" });
        continue;
      }

      const hadManifest = existsSync(manifestPath);
      const engram = await this.repository.get(id);

      if (!engram) {
        result.skipped.push({ id, reason: "failed to load engram metadata" });
        continue;
      }

      if (!hadManifest && existsSync(manifestPath)) {
        result.migrated.push(id);
      } else {
        result.alreadyUpToDate.push(id);
      }
    }

    return result;
  }
}
