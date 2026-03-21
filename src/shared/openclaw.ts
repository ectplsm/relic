import { join } from "node:path";
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

/**
 * OpenClawのエージェントディレクトリパスを解決する。
 *
 * agent名 = Engram ID の規約に基づき、常に agents/<engramId>/agent/ を返す。
 */
export function resolveAgentPath(
  engramId: string,
  openclawDir?: string
): string {
  const baseDir = openclawDir ?? DEFAULT_OPENCLAW_DIR;
  return join(baseDir, "agents", engramId, "agent");
}
