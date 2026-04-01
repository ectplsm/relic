import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { EngramRepository } from "../ports/engram-repository.js";
import type { Engram } from "../entities/engram.js";

/**
 * Legacy sample Engram ID → new sample Engram ID mapping.
 * Used during seed to copy memory data from old samples.
 */
const LEGACY_MAPPING: Record<string, string> = {
  johnny: "rebel",
  motoko: "commander",
};

export interface RefreshSamplesResult {
  refreshed: string[];
  seeded: string[];
  skipped: Array<{ id: string; reason: string }>;
  migratedMemory: Array<{ from: string; to: string }>;
}

/**
 * RefreshSamples — サンプルEngramの人格ファイルを最新テンプレートで上書きする
 *
 * memory / USER / archive などの運用データは保持し、
 * SOUL.md / IDENTITY.md と updatedAt のみを更新する。
 *
 * ローカルに存在しないテンプレートは新規 seed する。
 * seed 時、旧サンプルの記憶データがあれば対応する新サンプルにコピーする。
 */
export class RefreshSamples {
  constructor(
    private readonly repository: EngramRepository,
    private readonly templatesDir: string
  ) {}

  async execute(targetIds?: string[]): Promise<RefreshSamplesResult> {
    const ids = targetIds && targetIds.length > 0
      ? targetIds
      : await this.listTemplateIds();

    const result: RefreshSamplesResult = {
      refreshed: [],
      seeded: [],
      skipped: [],
      migratedMemory: [],
    };

    for (const id of ids) {
      const templateDir = join(this.templatesDir, id);
      if (!existsSync(templateDir)) {
        result.skipped.push({ id, reason: "sample template not found" });
        continue;
      }

      const soulPath = join(templateDir, "SOUL.md");
      const identityPath = join(templateDir, "IDENTITY.md");
      if (!existsSync(soulPath) || !existsSync(identityPath)) {
        result.skipped.push({ id, reason: "template persona files are incomplete" });
        continue;
      }

      const engram = await this.repository.get(id);
      if (engram) {
        // Existing engram — refresh persona files only
        engram.files.soul = await readFile(soulPath, "utf-8");
        engram.files.identity = await readFile(identityPath, "utf-8");
        engram.meta.updatedAt = new Date().toISOString();

        await this.repository.save(engram);
        result.refreshed.push(id);
      } else {
        // New sample — seed it
        const seeded = await this.seedFromTemplate(id, templateDir, soulPath, identityPath);
        if (seeded) {
          result.seeded.push(id);

          // Migrate memory from legacy sample if available
          const migrated = await this.migrateMemoryFromLegacy(id);
          if (migrated) {
            result.migratedMemory.push(migrated);
          }
        } else {
          result.skipped.push({ id, reason: "template engram.json not found (cannot seed)" });
        }
      }
    }

    return result;
  }

  private async seedFromTemplate(
    id: string,
    templateDir: string,
    soulPath: string,
    identityPath: string
  ): Promise<boolean> {
    const engramJsonPath = join(templateDir, "engram.json");
    if (!existsSync(engramJsonPath)) {
      return false;
    }

    const profile = JSON.parse(await readFile(engramJsonPath, "utf-8"));
    const soul = await readFile(soulPath, "utf-8");
    const identity = await readFile(identityPath, "utf-8");
    const now = new Date().toISOString();

    const engram: Engram = {
      meta: {
        id,
        name: profile.name ?? id,
        description: profile.description,
        tags: profile.tags,
        createdAt: now,
        updatedAt: now,
      },
      files: {
        soul,
        identity,
      },
    };

    await this.repository.save(engram);
    return true;
  }

  /**
   * 旧サンプルEngramから記憶データをコピーする。
   * LEGACY_MAPPING に定義されたマッピングに基づき、
   * USER.md / MEMORY.md / memory/*.md を引き継ぐ。
   */
  private async migrateMemoryFromLegacy(
    newId: string
  ): Promise<{ from: string; to: string } | null> {
    // Find legacy ID that maps to this new ID
    const legacyId = Object.entries(LEGACY_MAPPING)
      .find(([, v]) => v === newId)?.[0];
    if (!legacyId) return null;

    const legacy = await this.repository.get(legacyId);
    if (!legacy) return null;

    // Check if legacy has any memory data worth copying
    const hasMemory = legacy.files.user
      || legacy.files.memory
      || (legacy.files.memoryEntries && Object.keys(legacy.files.memoryEntries).length > 0);
    if (!hasMemory) return null;

    // Load the newly seeded engram and merge memory data
    const newEngram = await this.repository.get(newId);
    if (!newEngram) return null;

    if (legacy.files.user) newEngram.files.user = legacy.files.user;
    if (legacy.files.memory) newEngram.files.memory = legacy.files.memory;
    if (legacy.files.memoryEntries) {
      newEngram.files.memoryEntries = { ...legacy.files.memoryEntries };
    }
    newEngram.meta.updatedAt = new Date().toISOString();

    await this.repository.save(newEngram);
    return { from: legacyId, to: newId };
  }

  private async listTemplateIds(): Promise<string[]> {
    if (!existsSync(this.templatesDir)) {
      return [];
    }

    const entries = await readdir(this.templatesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  }
}
