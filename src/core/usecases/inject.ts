import { join } from "node:path";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import type { EngramRepository } from "../ports/engram-repository.js";
import type { EngramFiles } from "../entities/engram.js";
import { FILE_MAP, resolveWorkspacePath } from "../../shared/openclaw.js";

export interface InjectResult {
  engramId: string;
  engramName: string;
  targetPath: string;
  filesWritten: string[];
}

/**
 * Inject — EngramのファイルをOpenClawワークスペースに注入する
 *
 * OpenClawではエージェントごとに workspace-<name>/ を使い、
 * デフォルト(main)エージェントのみ workspace/ を使う。
 * memoryEntries はOpenClaw側の管理に委ねるため注入しない。
 */
export class Inject {
  constructor(private readonly repository: EngramRepository) {}

  async execute(
    engramId: string,
    options?: {
      to?: string;
      openclawDir?: string;
    }
  ): Promise<InjectResult> {
    const engram = await this.repository.get(engramId);
    if (!engram) {
      throw new InjectEngramNotFoundError(engramId);
    }

    const agentName = options?.to ?? engramId;
    const targetPath = resolveWorkspacePath(agentName, options?.openclawDir);

    if (!existsSync(targetPath)) {
      throw new InjectWorkspaceNotFoundError(agentName);
    }

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

export class InjectWorkspaceNotFoundError extends Error {
  constructor(engramId: string) {
    super(
      `OpenClaw agent "${engramId}" has not been created yet. Run "openclaw agents add ${engramId}" first, then try again.`
    );
    this.name = "InjectWorkspaceNotFoundError";
  }
}
