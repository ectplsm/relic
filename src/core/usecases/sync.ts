import { join } from "node:path";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import type { EngramRepository } from "../ports/engram-repository.js";
import { Inject } from "./inject.js";
import { Extract } from "./extract.js";

const DEFAULT_OPENCLAW_DIR = join(homedir(), ".openclaw");

export interface SyncTarget {
  engramId: string;
  agentPath: string;
  hasEngram: boolean;
}

export interface SyncInitialResult {
  injected: string[];
  extracted: string[];
  targets: SyncTarget[];
}

/**
 * Sync — OpenClawのagentsディレクトリをスキャンし、
 * 一致するEngramをinject / memoryをextractする。
 *
 * 初回スキャン後は、呼び出し側がファイル監視を行い、
 * 変更検知時に syncMemory() を呼ぶ。
 */
export class Sync {
  private readonly inject: Inject;
  private readonly extract: Extract;

  constructor(private readonly repository: EngramRepository) {
    this.inject = new Inject(repository);
    this.extract = new Extract(repository);
  }

  /**
   * OpenClawのagentsディレクトリをスキャンし、
   * Engramが存在するagentにはinject、全agentからmemoryをextractする。
   */
  async initialSync(openclawDir?: string): Promise<SyncInitialResult> {
    const baseDir = openclawDir ?? DEFAULT_OPENCLAW_DIR;
    const agentsDir = join(baseDir, "agents");

    if (!existsSync(agentsDir)) {
      throw new SyncAgentsDirNotFoundError(agentsDir);
    }

    const targets = await this.scanAgents(agentsDir);
    const injected: string[] = [];
    const extracted: string[] = [];

    for (const target of targets) {
      // Engramがあるagentにはpersonaを注入
      if (target.hasEngram) {
        try {
          await this.inject.execute(target.engramId, openclawDir);
          injected.push(target.engramId);
        } catch {
          // inject失敗は警告として続行
        }
      }

      // 全agentからmemoryを抽出
      try {
        await this.extract.execute(target.engramId, {
          openclawDir,
        });
        extracted.push(target.engramId);
      } catch {
        // extract失敗（新規Engramでname未指定等）はスキップ
      }
    }

    return { injected, extracted, targets };
  }

  /**
   * 特定agentのmemoryを同期（ファイル変更検知時に呼ばれる）
   */
  async syncMemory(
    engramId: string,
    openclawDir?: string
  ): Promise<void> {
    await this.extract.execute(engramId, { openclawDir });
  }

  /**
   * agentsディレクトリをスキャンしてターゲット一覧を返す
   */
  private async scanAgents(agentsDir: string): Promise<SyncTarget[]> {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    const targets: SyncTarget[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const agentPath = join(agentsDir, entry.name, "agent");
      if (!existsSync(agentPath)) continue;

      const engram = await this.repository.get(entry.name);
      targets.push({
        engramId: entry.name,
        agentPath,
        hasEngram: engram !== null,
      });
    }

    return targets;
  }
}

export class SyncAgentsDirNotFoundError extends Error {
  constructor(path: string) {
    super(`OpenClaw agents directory not found at ${path}`);
    this.name = "SyncAgentsDirNotFoundError";
  }
}
