import { join } from "node:path";
import { homedir } from "node:os";
import type { EngramFiles } from "../core/entities/engram.js";

const DEFAULT_OPENCLAW_DIR = join(homedir(), ".openclaw");

/**
 * デフォルト(main)エージェントのワークスペース名。
 * OpenClawではプロファイルなしの場合 workspace/ が使われる。
 */
const DEFAULT_AGENT_NAME = "main";

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

/**
 * OpenClawのワークスペースディレクトリパスを解決する。
 *
 * OpenClawではエージェントごとに workspace-<name>/ を使い、
 * デフォルト(main)エージェントのみ workspace/ を使う。
 */
export function resolveWorkspacePath(
  engramId: string,
  openclawDir?: string
): string {
  const baseDir = openclawDir ?? DEFAULT_OPENCLAW_DIR;
  if (engramId === DEFAULT_AGENT_NAME) {
    return join(baseDir, "workspace");
  }
  return join(baseDir, `workspace-${engramId}`);
}

/**
 * OpenClawのワークスペースディレクトリ名からエージェント名を抽出する。
 * "workspace" → "main", "workspace-johnny" → "johnny"
 */
export function extractAgentName(dirName: string): string | null {
  if (dirName === "workspace") {
    return DEFAULT_AGENT_NAME;
  }
  const match = dirName.match(/^workspace-(.+)$/);
  return match ? match[1] : null;
}
