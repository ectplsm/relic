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

/**
 * Relicが管理するファイル群。
 * SOUL, IDENTITY, USER, MEMORY の4種 + memory/*.md。
 * AGENTS/HEARTBEAT等はClaw側の管理に委ねる。
 *
 * - inject: SOUL, IDENTITY, USER のみ書き込み（MEMORYはauto-syncで処理）
 * - extract: 全て読み込み + memory/*.md
 * - sync: MEMORY + USER + memory/*.md を双方向マージ
 */
export const RELIC_FILE_MAP: Partial<typeof FILE_MAP> = {
  soul: "SOUL.md",
  identity: "IDENTITY.md",
  user: "USER.md",
  memory: "MEMORY.md",
};

/**
 * Inject時に書き込むファイルのサブセット。
 * ペルソナ定義（SOUL, IDENTITY）のみ。
 * USER/MEMORYはinject後のauto-syncで双方向マージされる。
 */
export const INJECT_FILE_MAP: Partial<typeof FILE_MAP> = {
  soul: "SOUL.md",
  identity: "IDENTITY.md",
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
