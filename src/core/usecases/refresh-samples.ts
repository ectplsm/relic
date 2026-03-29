import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { EngramRepository } from "../ports/engram-repository.js";

export interface RefreshSamplesResult {
  refreshed: string[];
  skipped: Array<{ id: string; reason: string }>;
}

/**
 * RefreshSamples — サンプルEngramの人格ファイルを最新テンプレートで上書きする
 *
 * memory / USER / archive などの運用データは保持し、
 * SOUL.md / IDENTITY.md と updatedAt のみを更新する。
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
      skipped: [],
    };

    for (const id of ids) {
      const templateDir = join(this.templatesDir, id);
      if (!existsSync(templateDir)) {
        result.skipped.push({ id, reason: "sample template not found" });
        continue;
      }

      const engram = await this.repository.get(id);
      if (!engram) {
        result.skipped.push({ id, reason: "local Engram not found" });
        continue;
      }

      const soulPath = join(templateDir, "SOUL.md");
      const identityPath = join(templateDir, "IDENTITY.md");
      if (!existsSync(soulPath) || !existsSync(identityPath)) {
        result.skipped.push({ id, reason: "template persona files are incomplete" });
        continue;
      }

      engram.files.soul = await readFile(soulPath, "utf-8");
      engram.files.identity = await readFile(identityPath, "utf-8");
      engram.meta.updatedAt = new Date().toISOString();

      await this.repository.save(engram);
      result.refreshed.push(id);
    }

    return result;
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
