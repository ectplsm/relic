import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { EngramRepository } from "../ports/engram-repository.js";
import type { Engram } from "../entities/engram.js";

export interface RefreshSamplesResult {
  refreshed: string[];
  seeded: string[];
  skipped: Array<{ id: string; reason: string }>;
}

/**
 * RefreshSamples — サンプルEngramの人格ファイルを最新テンプレートで上書きする
 *
 * memory / USER / archive などの運用データは保持し、
 * SOUL.md / IDENTITY.md と updatedAt のみを更新する。
 *
 * ローカルに存在しないテンプレートは新規 seed する。
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
