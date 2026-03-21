import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import type { EngramRepository } from "../ports/engram-repository.js";
import type { Engram, EngramFiles } from "../entities/engram.js";
import {
  FILE_MAP,
  MEMORY_DIR,
  resolveOpenClawTarget,
} from "../../shared/openclaw.js";

export interface ExtractResult {
  engramId: string;
  engramName: string;
  sourcePath: string;
  mode: "single" | "multi";
  agent: string;
  filesRead: string[];
}

/**
 * Extract — OpenClawワークスペースからEngramを作成する
 */
export class Extract {
  constructor(private readonly repository: EngramRepository) {}

  async execute(
    engramId: string,
    engramName: string,
    agentName?: string,
    openclawDir?: string
  ): Promise<ExtractResult> {
    const { targetPath, mode, agent } = resolveOpenClawTarget(
      agentName,
      openclawDir
    );

    if (!existsSync(targetPath)) {
      throw new WorkspaceNotFoundError(targetPath);
    }

    const { files, filesRead } = await this.readFiles(targetPath);

    if (filesRead.length === 0) {
      throw new WorkspaceEmptyError(targetPath);
    }

    const now = new Date().toISOString();
    const engram: Engram = {
      meta: {
        id: engramId,
        name: engramName,
        description: `Extracted from OpenClaw ${mode}-agent (${agent})`,
        createdAt: now,
        updatedAt: now,
        tags: ["extracted", "openclaw"],
      },
      files,
    };

    await this.repository.save(engram);

    return {
      engramId,
      engramName,
      sourcePath: targetPath,
      mode,
      agent,
      filesRead,
    };
  }

  private async readFiles(
    sourcePath: string
  ): Promise<{ files: EngramFiles; filesRead: string[] }> {
    const files: Partial<EngramFiles> = {};
    const filesRead: string[] = [];

    for (const [key, filename] of Object.entries(FILE_MAP)) {
      const filePath = join(sourcePath, filename);
      if (existsSync(filePath)) {
        (files as Record<string, string>)[key] = await readFile(
          filePath,
          "utf-8"
        );
        filesRead.push(filename);
      }
    }

    const memoryDir = join(sourcePath, MEMORY_DIR);
    if (existsSync(memoryDir)) {
      const entries = await readdir(memoryDir);
      const mdFiles = entries.filter((f) => f.endsWith(".md")).sort();
      if (mdFiles.length > 0) {
        files.memoryEntries = {};
        for (const mdFile of mdFiles) {
          const date = mdFile.replace(/\.md$/, "");
          files.memoryEntries[date] = await readFile(
            join(memoryDir, mdFile),
            "utf-8"
          );
          filesRead.push(`${MEMORY_DIR}/${mdFile}`);
        }
      }
    }

    return { files: files as EngramFiles, filesRead };
  }
}

export class WorkspaceNotFoundError extends Error {
  constructor(path: string) {
    super(`OpenClaw workspace not found at ${path}`);
    this.name = "WorkspaceNotFoundError";
  }
}

export class WorkspaceEmptyError extends Error {
  constructor(path: string) {
    super(`No workspace files found at ${path}`);
    this.name = "WorkspaceEmptyError";
  }
}
