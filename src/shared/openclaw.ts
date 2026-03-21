import { join } from "node:path";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import type { EngramFiles } from "../core/entities/engram.js";

const DEFAULT_OPENCLAW_DIR = join(homedir(), ".openclaw");

export const FILE_MAP: Record<
  keyof Omit<EngramFiles, "memoryEntries">,
  string
> = {
  soul: "SOUL.md",
  identity: "IDENTITY.md",
  agents: "AGENTS.md",
  user: "USER.md",
  memory: "MEMORY.md",
  heartbeat: "HEARTBEAT.md",
};

export const MEMORY_DIR = "memory";

export interface ResolvedTarget {
  targetPath: string;
  mode: "single" | "multi";
  agent: string;
}

/**
 * OpenClawワークスペースのターゲットディレクトリを解決する。
 *
 * - openclawDir: OpenClawのベースディレクトリ（デフォルト: ~/.openclaw）
 * - agentName 指定あり → agents/<name>/agent/
 * - agentName 指定なし → agents/ の有無で自動検出
 */
export function resolveOpenClawTarget(
  agentName?: string,
  openclawDir?: string
): ResolvedTarget {
  const baseDir = openclawDir ?? DEFAULT_OPENCLAW_DIR;
  const agentsDir = join(baseDir, "agents");
  const workspaceDir = join(baseDir, "workspace");

  if (agentName) {
    const targetPath = join(agentsDir, agentName, "agent");
    if (!existsSync(targetPath)) {
      throw new AgentNotFoundError(agentName, targetPath);
    }
    return { targetPath, mode: "multi", agent: agentName };
  }

  if (existsSync(agentsDir)) {
    const targetPath = join(agentsDir, "main", "agent");
    return { targetPath, mode: "multi", agent: "main" };
  }

  return { targetPath: workspaceDir, mode: "single", agent: "main" };
}

export class AgentNotFoundError extends Error {
  constructor(agent: string, path: string) {
    super(`Agent "${agent}" not found at ${path}`);
    this.name = "AgentNotFoundError";
  }
}
