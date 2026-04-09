import { join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { EngramRepository } from "../ports/engram-repository.js";
import type { EngramFiles } from "../entities/engram.js";
import { INJECT_FILE_MAP, resolveWorkspacePath } from "../../shared/openclaw.js";

export type InjectPersonaFileDiff = "missing" | "same" | "different" | "skipped";

export interface InjectPersonaDiffResult {
  engramId: string;
  engramName: string;
  targetPath: string;
  targetExists: boolean;
  soul: InjectPersonaFileDiff;
  identity: InjectPersonaFileDiff;
  overwriteRequired: boolean;
}

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

  async inspectPersona(
    engramId: string,
    options?: {
      openclawDir?: string;
      mergeIdentity?: boolean;
    }
  ): Promise<InjectPersonaDiffResult> {
    const { engram, targetPath } = await this.loadInjectTarget(engramId, options);
    const mergeIdentity = options?.mergeIdentity ?? false;
    const targetExists = existsSync(targetPath);

    const soul = await this.compareTargetFile(
      join(targetPath, INJECT_FILE_MAP.soul!),
      this.resolveInjectedContent("soul", engram.files, mergeIdentity)
    );

    const identity = mergeIdentity
      ? "skipped"
      : await this.compareTargetFile(
          join(targetPath, INJECT_FILE_MAP.identity!),
          this.resolveInjectedContent("identity", engram.files, mergeIdentity)
        );

    return {
      engramId: engram.meta.id,
      engramName: engram.meta.name,
      targetPath,
      targetExists,
      soul,
      identity,
      overwriteRequired: soul === "different" || identity === "different",
    };
  }

  async execute(
    engramId: string,
    options?: {
      openclawDir?: string;
      mergeIdentity?: boolean;
    }
  ): Promise<InjectResult> {
    const { engram, targetPath } = await this.loadInjectTarget(engramId, options);

    await mkdir(targetPath, { recursive: true });

    const filesWritten = await this.writeFiles(
      targetPath,
      engram.files,
      options?.mergeIdentity ?? false
    );

    return {
      engramId: engram.meta.id,
      engramName: engram.meta.name,
      targetPath,
      filesWritten,
    };
  }

  private async loadInjectTarget(
    engramId: string,
    options?: {
      openclawDir?: string;
      mergeIdentity?: boolean;
    }
  ): Promise<{ engram: NonNullable<Awaited<ReturnType<EngramRepository["get"]>>>; targetPath: string }> {
    const engram = await this.repository.get(engramId);
    if (!engram) {
      throw new InjectEngramNotFoundError(engramId);
    }

    if (options?.openclawDir && !existsSync(options.openclawDir)) {
      throw new InjectClawDirNotFoundError(options.openclawDir);
    }

    const targetPath = resolveWorkspacePath(engramId, options?.openclawDir);
    return { engram, targetPath };
  }

  private resolveInjectedContent(
    key: keyof typeof INJECT_FILE_MAP,
    files: EngramFiles,
    mergeIdentity: boolean
  ): string | undefined {
    if (mergeIdentity && key === "identity") {
      return undefined;
    }

    let content = files[key as keyof typeof INJECT_FILE_MAP];
    if (mergeIdentity && key === "soul" && files.identity) {
      content = content + "\n" + files.identity;
    }
    return content;
  }

  private async compareTargetFile(
    filePath: string,
    expectedContent: string | undefined
  ): Promise<InjectPersonaFileDiff> {
    if (expectedContent === undefined) {
      return "skipped";
    }

    if (!existsSync(filePath)) {
      return "missing";
    }

    const currentContent = await readFile(filePath, "utf-8");
    return currentContent === expectedContent ? "same" : "different";
  }

  private async writeFiles(
    targetPath: string,
    files: EngramFiles,
    mergeIdentity: boolean
  ): Promise<string[]> {
    const written: string[] = [];

    for (const [key, filename] of Object.entries(INJECT_FILE_MAP)) {
      // --merge-identity: skip IDENTITY.md (merged into SOUL.md below)
      if (mergeIdentity && key === "identity") {
        continue;
      }

      const content = this.resolveInjectedContent(
        key as keyof typeof INJECT_FILE_MAP,
        files,
        mergeIdentity
      );

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

export class InjectClawDirNotFoundError extends Error {
  constructor(path: string) {
    super(`Claw directory not found at ${path}`);
    this.name = "InjectClawDirNotFoundError";
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
