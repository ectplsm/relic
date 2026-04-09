import { join } from "node:path";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import type { EngramRepository } from "../ports/engram-repository.js";
import type { Engram, EngramFiles } from "../entities/engram.js";
import { RELIC_FILE_MAP, MEMORY_DIR, resolveWorkspacePath } from "../../shared/openclaw.js";

export type ExtractPersonaFileDiff = "missing" | "same" | "different";

export interface ExtractPersonaDiffResult {
  engramId: string;
  engramName: string;
  sourcePath: string;
  existing: boolean;
  name: ExtractPersonaFileDiff;
  soul: ExtractPersonaFileDiff;
  identity: ExtractPersonaFileDiff;
  overwriteRequired: boolean;
}

export interface ExtractResult {
  engramId: string;
  engramName: string;
  sourcePath: string;
  filesRead: string[];
}

/**
 * Extract — OpenClawワークスペースからEngramを新規作成する
 *
 * 初回取り込み専用。Engramが既に存在する場合はエラーを返す。
 * Relicが真のデータソースであり、extractは初期インポートのみを担う。
 */
export class Extract {
  constructor(private readonly repository: EngramRepository) {}

  async inspectPersona(
    agentName: string,
    options?: {
      name?: string;
      openclawDir?: string;
    }
  ): Promise<ExtractPersonaDiffResult> {
    const sourcePath = resolveWorkspacePath(agentName, options?.openclawDir);

    if (!existsSync(sourcePath)) {
      throw new WorkspaceNotFoundError(sourcePath);
    }

    const { files } = await this.readFiles(sourcePath);
    const existing = await this.repository.get(agentName);

    if (!existing) {
      return {
        engramId: agentName,
        engramName: options?.name ?? agentName,
        sourcePath,
        existing: false,
        name: "missing",
        soul: "missing",
        identity: "missing",
        overwriteRequired: false,
      };
    }

    const requestedName = options?.name ?? existing.meta.name;
    const name = requestedName === existing.meta.name ? "same" : "different";
    const soul = this.comparePersonaFile(existing.files.soul, files.soul);
    const identity = this.comparePersonaFile(existing.files.identity, files.identity);

    return {
      engramId: agentName,
      engramName: existing.meta.name,
      sourcePath,
      existing: true,
      name,
      soul,
      identity,
      overwriteRequired:
        name === "different" ||
        soul === "different" ||
        identity === "different",
    };
  }

  async execute(
    agentName: string,
    options?: {
      name?: string;
      openclawDir?: string;
    }
  ): Promise<ExtractResult> {
    const sourcePath = resolveWorkspacePath(agentName, options?.openclawDir);

    if (!existsSync(sourcePath)) {
      throw new WorkspaceNotFoundError(sourcePath);
    }

    const existing = await this.repository.get(agentName);
    if (existing) {
      throw new AlreadyExtractedError(agentName);
    }

    const { files, filesRead } = await this.readFiles(sourcePath);

    if (filesRead.length === 0) {
      throw new WorkspaceEmptyError(sourcePath);
    }

    const now = new Date().toISOString();
    const engram: Engram = {
      meta: {
        id: agentName,
        name: options?.name ?? agentName,
        description: `Extracted from OpenClaw workspace (${agentName})`,
        createdAt: now,
        updatedAt: now,
        tags: ["extracted", "openclaw"],
      },
      files,
    };

    await this.repository.save(engram);

    return {
      engramId: agentName,
      engramName: engram.meta.name,
      sourcePath,
      filesRead,
    };
  }

  private comparePersonaFile(
    currentContent: string | undefined,
    incomingContent: string | undefined
  ): ExtractPersonaFileDiff {
    if (currentContent === undefined || incomingContent === undefined) {
      return "missing";
    }
    return currentContent === incomingContent ? "same" : "different";
  }

  private async readFiles(
    sourcePath: string
  ): Promise<{ files: EngramFiles; filesRead: string[] }> {
    const files: Partial<EngramFiles> = {};
    const filesRead: string[] = [];

    for (const [key, filename] of Object.entries(RELIC_FILE_MAP)) {
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

export class AlreadyExtractedError extends Error {
  constructor(id: string) {
    super(
      `Engram "${id}" already exists. Use "relic claw pull" to update it.`
    );
    this.name = "AlreadyExtractedError";
  }
}
