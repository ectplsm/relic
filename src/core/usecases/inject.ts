import { join } from "node:path";
import { writeFile, mkdir } from "node:fs/promises";
import type { EngramRepository } from "../ports/engram-repository.js";
import type { EngramFiles } from "../entities/engram.js";
import { FILE_MAP, resolveAgentPath } from "../../shared/openclaw.js";

export interface InjectResult {
  engramId: string;
  engramName: string;
  targetPath: string;
  filesWritten: string[];
}

/**
 * Inject — EngramのファイルをOpenClawワークスペースに注入する
 *
 * agent名 = Engram ID の規約に基づき、agents/<engramId>/agent/ に書き込む。
 * memoryEntries はOpenClaw側の管理に委ねるため注入しない。
 */
export class Inject {
  constructor(private readonly repository: EngramRepository) {}

  async execute(
    engramId: string,
    openclawDir?: string
  ): Promise<InjectResult> {
    const engram = await this.repository.get(engramId);
    if (!engram) {
      throw new InjectEngramNotFoundError(engramId);
    }

    const targetPath = resolveAgentPath(engramId, openclawDir);
    const filesWritten = await this.writeFiles(targetPath, engram.files);

    return {
      engramId: engram.meta.id,
      engramName: engram.meta.name,
      targetPath,
      filesWritten,
    };
  }

  private async writeFiles(
    targetPath: string,
    files: EngramFiles
  ): Promise<string[]> {
    await mkdir(targetPath, { recursive: true });

    const written: string[] = [];

    for (const [key, filename] of Object.entries(FILE_MAP)) {
      const content = files[key as keyof typeof FILE_MAP];
      if (content !== undefined) {
        await writeFile(join(targetPath, filename), content, "utf-8");
        written.push(filename);
      }
    }

    return written;
  }
}

export class InjectEngramNotFoundError extends Error {
  constructor(id: string) {
    super(`Engram "${id}" not found`);
    this.name = "InjectEngramNotFoundError";
  }
}
