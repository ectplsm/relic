import { join } from "node:path";
import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import type { EngramRepository } from "../ports/engram-repository.js";
import type { EngramFiles } from "../entities/engram.js";

const OPENCLAW_DIR = join(homedir(), ".openclaw");
const WORKSPACE_DIR = join(OPENCLAW_DIR, "workspace");
const AGENTS_DIR = join(OPENCLAW_DIR, "agents");

const FILE_MAP: Record<keyof Omit<EngramFiles, "memoryEntries">, string> = {
  soul: "SOUL.md",
  identity: "IDENTITY.md",
  agents: "AGENTS.md",
  user: "USER.md",
  memory: "MEMORY.md",
  heartbeat: "HEARTBEAT.md",
};

const MEMORY_DIR = "memory";

export interface InjectResult {
  engramId: string;
  engramName: string;
  targetPath: string;
  mode: "single" | "multi";
  agent: string;
  filesWritten: string[];
}

/**
 * Inject — EngramのファイルをOpenClawワークスペースに注入する
 */
export class Inject {
  constructor(private readonly repository: EngramRepository) {}

  async execute(
    engramId: string,
    agentName?: string
  ): Promise<InjectResult> {
    const engram = await this.repository.get(engramId);
    if (!engram) {
      throw new InjectEngramNotFoundError(engramId);
    }

    const { targetPath, mode, agent } = this.resolveTarget(agentName);
    const filesWritten = await this.writeFiles(targetPath, engram.files);

    return {
      engramId: engram.meta.id,
      engramName: engram.meta.name,
      targetPath,
      mode,
      agent,
      filesWritten,
    };
  }

  private resolveTarget(agentName?: string): {
    targetPath: string;
    mode: "single" | "multi";
    agent: string;
  } {
    if (agentName) {
      // --agent specified: always assume multi-agent
      const targetPath = join(AGENTS_DIR, agentName, "agent");
      if (!existsSync(targetPath)) {
        throw new AgentNotFoundError(agentName);
      }
      return { targetPath, mode: "multi", agent: agentName };
    }

    // No --agent: detect mode
    if (existsSync(AGENTS_DIR)) {
      // Multi-agent mode: target main agent
      const targetPath = join(AGENTS_DIR, "main", "agent");
      return { targetPath, mode: "multi", agent: "main" };
    }

    // Single-agent mode: target workspace
    return { targetPath: WORKSPACE_DIR, mode: "single", agent: "main" };
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

    if (files.memoryEntries) {
      const memoryDir = join(targetPath, MEMORY_DIR);
      await mkdir(memoryDir, { recursive: true });
      for (const [date, content] of Object.entries(files.memoryEntries)) {
        const filename = `${date}.md`;
        await writeFile(join(memoryDir, filename), content, "utf-8");
        written.push(`${MEMORY_DIR}/${filename}`);
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

export class AgentNotFoundError extends Error {
  constructor(agent: string) {
    super(
      `Agent "${agent}" not found at ~/.openclaw/agents/${agent}/agent/`
    );
    this.name = "AgentNotFoundError";
  }
}
